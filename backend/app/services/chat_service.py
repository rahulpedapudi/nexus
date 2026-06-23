import asyncio
import json
import logging
import time
from typing import AsyncGenerator
import os
from dotenv import load_dotenv

from app.services import keys_service
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.message import Message
from app.models.conversation import Conversation
from app.schemas.message import MessageCreate
from app.services.llm_service import stream_response
from app.models.user import User
from app.services.conversation_service import get_or_create_bot_conversation, create_conversation
from app.services import memory_service
from app.services import memory_extractor

from app.services import llm_service

load_dotenv()

logger = logging.getLogger(__name__)


def _get_api_key(db: Session, user: User) -> str:
    """Fetch and return the user's Groq API key or raise HTTP 400."""
    key = keys_service.get_key(db, user, provider="groq")
    if not key:
        raise HTTPException(status_code=400, detail="API key not found")
    return key


def _get_conversation(data: MessageCreate, db: Session, user: User) -> Conversation:
    if data.source == "telegram":
        return get_or_create_bot_conversation("telegram", user.id, db)

    if data.source == "discord":
        return get_or_create_bot_conversation("discord", user.id, db)

    # Web: auto-create a new conversation if no conv_id supplied
    if not data.conv_id:
        return create_conversation(db, user)

    conversation = db.query(Conversation).filter(
        Conversation.id == data.conv_id,
        Conversation.user_id == user.id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def _save_user_message(data: MessageCreate, conversation: Conversation, db: Session, user: User) -> Message:
    msg = Message(
        content=data.content,
        role="user",
        telegram_user_id=data.telegram_user_id if data.telegram_user_id else None,
        user_id=user.id,
        conv_id=conversation.id,
        source=data.source if data.source else "web",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

#! this adds latency
#! i already implemented search_memories tool for the llm to use; and also recent messages are passed as a context; so this is may not be needed;


def _retrieve_relevant_memories(db, user, query) -> str:
    # 1. search_memories(data.content)
    memories = memory_service.search_memories(db, user, query)

    # 2. format the retrieved memories
    if not memories:
        return "No relevant memories found."

    return "\n".join([f"- {m.content}" for m in memories])


def _build_context(conversation: Conversation, db: Session, user: User) -> list[dict]:
    """Return the last 3 messages as a list of {role, content} dicts."""
    # TODO: implement context summarisation when messages > 10
    recent = (
        db.query(Message)
        .filter(Message.conv_id == conversation.id, Message.user_id == user.id)
        .order_by(Message.created_at.desc())
        .limit(3)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in reversed(recent)]


async def _save_assistant_message(
    content: str,
    conversation: Conversation,
    data: MessageCreate,
    db: Session,
    user: User,
) -> Message:
    msg = Message(
        content=content,
        role="assistant",
        user_id=user.id,
        telegram_user_id=data.telegram_user_id if data.telegram_user_id else None,
        conv_id=conversation.id,
        source=data.source if data.source else "web",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


async def _extract_and_store(user: User, user_msg: str, assistant_msg: str, api_key: str, db: Session):
    t0 = time.perf_counter()
    try:
        memories = await memory_extractor.extract_memories(user_msg, assistant_msg, user, db, api_key)
        stored = 0
        for m in memories:
            memory_service.store_memory(
                content=m["content"],
                category=m["category"],
                source="auto",
                db=db,
                user=user,
            )
            stored += 1
        logger.info(
            "_extract_and_store | user=%s | extracted=%d | stored=%d | took=%.3fs",
            user.id, len(memories), stored, time.perf_counter() - t0,
        )
    except Exception:
        logger.exception("_extract_and_store failed | user=%s | took=%.3fs",
                         user.id, time.perf_counter() - t0)
        pass  # extraction is best-effort; don't surface errors to the user


#! USED BY DISCORD
async def chat(data: MessageCreate, db: Session, current_user: User) -> Message:
    """Blocking chat — full response in one shot."""
    total_t0 = time.perf_counter()

    # api_key = _get_api_key(db, current_user)
    api_key = os.getenv("GROQ_API_KEY")

    conversation = _get_conversation(data, db, current_user)
    _save_user_message(data, conversation, db, current_user)
    # memories = _retrieve_relevant_memories(db, current_user, data.content)

    t0 = time.perf_counter()

    context = _build_context(conversation, db, current_user)
    logger.info("chat | context_build | user=%s | msgs=%d | took=%.3fs",
                current_user.id, len(context), time.perf_counter() - t0)

    try:
        llm_text = await llm_service.get_llm_response(
            recent_messages=context, memories="",
            db=db, user=current_user, source=data.source or "web",
        )
    except RuntimeError as exc:
        # get_llm_response raises RuntimeError with a user-friendly message
        logger.warning("chat | llm_error | user=%s | %s", current_user.id, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    logger.info("chat | llm_response | user=%s | took=%.3fs",
                current_user.id, time.perf_counter() - t0)

    conv_id = conversation.id
    user_id = current_user.id

    msg = Message(
        content=llm_text,
        role="assistant",
        user_id=user_id,
        telegram_user_id=data.telegram_user_id if data.telegram_user_id else None,
        conv_id=conv_id,
        source=data.source if data.source else "web",
    )
    db.add(msg)
    db.commit()

    logger.info("chat | done | user=%s | total=%.3fs",
                current_user.id, time.perf_counter() - total_t0)

    asyncio.create_task(
        _extract_and_store(user=current_user, user_msg=data.content,
                           assistant_msg=llm_text, api_key=api_key, db=db)
    )

    return llm_text

#  streaming pipeline


async def stream_events(
    data: MessageCreate,
    db: Session,
    current_user: User,
) -> AsyncGenerator[dict, None]:
    """
    Core async generator that yields typed event dicts and persists the
    final message to the DB.  Consumed by both the web SSE wrapper and
    the Telegram streaming handler.

    Event shapes:
        {"type": "status",  "phase": "thinking" | "streaming" | "done"}
        {"type": "delta",   "text": "<token>"}
        {"type": "done",    "message_id": "...", "conv_id": "..."}
        {"type": "error",   "detail": "..."}
    """
    # ── DB setup (sync, completes before any yield) ─────────────────────
    total_t0 = time.perf_counter()
    try:
        # gets user's groq api key
        # api_key = _get_api_key(db, current_user)
        api_key = os.getenv("GROQ_API_KEY")

        # gets conversation - single conv_id if source is telegram, else auto-create a new conversation if no data.conv_id supplied
        conversation = _get_conversation(data, db, current_user)

        # saves user message
        _save_user_message(data, conversation, db, current_user)

        # TODO: need to retrieve relevant memories related to the query
        # memories = _retrieve_relevant_memories(db, current_user, data.content)

        # gets latest 15 messages for passing it as a context for the llm
        t0 = time.perf_counter()
        context = _build_context(conversation, db, current_user)
        logger.info("stream_events | context_build | user=%s | msgs=%d | took=%.3fs",
                    current_user.id, len(context), time.perf_counter() - t0)
    except HTTPException as exc:
        yield {"type": "error", "detail": exc.detail}
        return
    except Exception as exc:
        yield {"type": "error", "detail": "Setup failed: " + str(exc)}
        return

    # ── Stream from LLM ───────────────────────────────────────────────────────
    accumulated: list[str] = []

    async for event in stream_response(
        context, "", user=current_user, db=db, source=data.source or "web",
    ):
        event_type = event["type"]

        if event_type == "status":
            yield {"type": "status", "phase": event["phase"]}

        elif event_type == "delta":
            accumulated.append(event["text"])
            yield {"type": "delta", "text": event["text"]}

        elif event_type == "error":
            # Forward both detail and the optional machine-readable code
            yield {"type": "error", "code": event.get("code", "unknown_error"), "detail": event["detail"]}
            return

    # ── Persist and signal done ───────────────────────────────────────
    full_response = "".join(accumulated)
    try:
        saved = await _save_assistant_message(full_response, conversation, data, db, current_user)

        logger.info(
            "stream_events | done | user=%s | total=%.3fs",
            current_user.id, time.perf_counter() - total_t0,
        )

        yield {
            "type": "done",
            "message_id": str(saved.id),
            "conv_id": str(saved.conv_id),
            "full_text": full_response,
        }

        # Fire memory extraction as a background task — doesn't block the done event
        asyncio.create_task(
            _extract_and_store(current_user, data.content,
                               full_response, api_key, db)
        )

    except Exception as exc:
        yield {"type": "error", "detail": "Failed to persist message: " + str(exc)}


# ── Web SSE wrapper ───────────────────────────────────────────────────────────

async def chat_stream(
    data: MessageCreate,
    db: Session,
    current_user: User,
) -> AsyncGenerator[str, None]:
    """
    Thin SSE wrapper around stream_events().
    Yields raw  data: <json>\\n\\n  strings consumed by FastAPI StreamingResponse.
    """
    async for event in stream_events(data, db, current_user):
        yield f"data: {json.dumps(event)}\n\n"
