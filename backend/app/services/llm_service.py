from aiohttp import web_urldispatcher
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.config import settings
from app.agent.loop import run_agent
from typing import AsyncGenerator
from groq import AsyncGroq
from dotenv import load_dotenv
from datetime import datetime


import logging

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools.registry import TOOLS
from app.agent.tools.tool_executor import execute_tool


load_dotenv()
logger = logging.getLogger(__name__)

# ── Synchronous (used by Telegram bot) ───────────────────────────────────────

async def get_llm_response(recent_messages: list[dict], memories,api_key: str, db: Session, user: User) -> str:
    """Blocking call — returns the full response text. Used by the Telegram bot."""
    client = AsyncGroq(api_key=api_key)

    messages=[
        {"role": "system", "content": SYSTEM_PROMPT.format(
            memory_context=memories,
            current_datetime=datetime.now().strftime("%A, %d %B %Y %I:%M %p"),
            user_name=user.username,
        )}, 
        *recent_messages,
    ]

    await run_agent(messages=messages, db=db, user=user, api_key=api_key)

    response = await client.chat.completions.create(
        model=settings.MODEL,
        messages=messages,
    )

    return response.choices[0].message.content

# ── Async streaming (used by the web /chat/stream endpoint) ──────────────────

async def stream_response(
    recent_messages: list[dict],
    memories: str,
    user: User,
    db: Session,
    api_key: str,
) -> AsyncGenerator[dict, None]:
    """
    Async generator that yields typed event dicts consumed by chat_service.chat_stream.

    Event shapes:
      {"type": "status",      "phase": "thinking" | "streaming" | "done"}
      {"type": "delta",       "text": "<token>"}
      {"type": "error",       "detail": "<message>"}
    """
    client = AsyncGroq(api_key=api_key)

    # Signal that we're waiting for the first token
    yield {"type": "status", "phase": "thinking"}

    try:

        messages=[
            {"role": "system", "content": SYSTEM_PROMPT.format(
                memory_context=memories,
                current_datetime=datetime.now().strftime("%A, %d %B %Y %I:%M %p"),
                user_name=user.username,
            )}, 
            *recent_messages,
        ]

        await run_agent(messages, db, user, api_key)

        # handle the no-tool-call case (direct response)
        stream = await client.chat.completions.create(
            model=settings.MODEL,
            stream=True,
            messages=messages,
        )

        first_token = True
        async for chunk in stream:
            delta = chunk.choices[0].delta
            token = delta.content or ""

            if token:
                if first_token:
                    # Upgrade phase once real tokens start arriving
                    yield {"type": "status", "phase": "streaming"}
                    first_token = False
                yield {"type": "delta", "text": token}

    except Exception as exc:
        yield {"type": "error", "detail": str(exc)}
        return

    yield {"type": "status", "phase": "done"}
