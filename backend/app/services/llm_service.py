from sqlalchemy.orm import Session
from app.models.user import User
from app.core.config import settings
from typing import AsyncGenerator
from groq import AsyncGroq
from groq import (
    RateLimitError,
    AuthenticationError,
    APITimeoutError,
    BadRequestError,
    InternalServerError,
    APIConnectionError,
    PermissionDeniedError,
)
from dotenv import load_dotenv
from datetime import datetime
import json
import logging
import time

from app.agent.prompts import SYSTEM_PROMPT, DISCORD_FORMAT_ADDENDUM
from app.agent.tools.registry import TOOLS
from app.agent.tools.tool_executor import execute_tool

load_dotenv()
logger = logging.getLogger(__name__)


# ── Error classification ──────────────────────────────────────────────────────

def _classify_groq_error(exc: Exception) -> dict:
    """
    Maps a Groq SDK exception to a structured error event dict.

    Returned dict shape:
        {
            "type":   "error",
            "code":   "<machine_readable_code>",
            "detail": "<user-facing message>",
        }
    """
    if isinstance(exc, RateLimitError):
        return {
            "type": "error",
            "code": "rate_limited",
            "detail": "You've been rate-limited by Groq. Please wait a moment and try again.",
        }
    if isinstance(exc, AuthenticationError) or isinstance(exc, PermissionDeniedError):
        return {
            "type": "error",
            "code": "invalid_api_key",
            "detail": "Your Groq API key is invalid or has been revoked. Please update it in Settings.",
        }
    if isinstance(exc, APITimeoutError):
        return {
            "type": "error",
            "code": "timeout",
            "detail": "The request to Groq timed out. Check your connection and try again.",
        }
    if isinstance(exc, BadRequestError):
        # status 400 — usually a context-length / token-limit problem
        msg = getattr(exc, "message", str(exc))
        if "context" in msg.lower() or "token" in msg.lower() or "length" in msg.lower():
            return {
                "type": "error",
                "code": "context_too_long",
                "detail": "Your conversation is too long for the model's context window. Try starting a new conversation.",
            }
        return {
            "type": "error",
            "code": "bad_request",
            "detail": f"The request was rejected by Groq: {msg}",
        }
    if isinstance(exc, InternalServerError):
        return {
            "type": "error",
            "code": "groq_server_error",
            "detail": "Groq's servers returned an error. This is usually temporary — please try again.",
        }
    if isinstance(exc, APIConnectionError):
        return {
            "type": "error",
            "code": "connection_error",
            "detail": "Could not reach Groq's API. Check your internet connection and try again.",
        }
    # Fallback for any other unexpected error
    return {
        "type": "error",
        "code": "unknown_error",
        "detail": f"An unexpected error occurred: {exc}",
    }


def _build_system_messages(user: User, source: str = "web") -> list[dict]:
    content = SYSTEM_PROMPT.format(
        current_datetime=datetime.now().astimezone().strftime("%A, %d %B %Y %I:%M %p %z"),
        user_name=user.username,
    )
    if source == "discord":
        content += DISCORD_FORMAT_ADDENDUM
    return [
        {
            "role": "system",
            "content": content,
        }
    ]


# ── Non-streaming (used by Discord) ──────────────────────────────────────────

async def get_llm_response(
    recent_messages: list[dict],
    memories: str,
    api_key: str,
    db: Session,
    user: User,
    source: str = "web",
) -> str:
    """Single-pass agent loop for Discord — returns the full response text."""
    client = AsyncGroq(api_key=api_key)
    messages = _build_system_messages(user, source=source) + recent_messages
    total_t0 = time.perf_counter()
    loop_count = 0

    try:
      while True:
        loop_count += 1
        t0 = time.perf_counter()
        response = await client.chat.completions.create(
            model=settings.MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        logger.info("get_llm_response | probe #%d | took=%.3fs", loop_count, time.perf_counter() - t0)

        assistant_message = response.choices[0].message
        tool_calls = assistant_message.tool_calls

        logger.info("assistant_message | %s", assistant_message)
        logger.info("tool_calls | %s", tool_calls)

        if not tool_calls:
            # No tools needed — return text directly (single LLM call)
            logger.info(
                "get_llm_response | done | user=%s | probes=%d | total=%.3fs",
                user.id, loop_count, time.perf_counter() - total_t0,
            )
            return assistant_message.content or ""

        # Execute tool calls and loop
        messages.append(assistant_message)
        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)
            tc_t0 = time.perf_counter()
            tool_result = execute_tool(
                tool_name=tool_name,
                user=user,
                db=db,
                arguments=arguments,
            )
            logger.info("get_llm_response | tool=%s | took=%.3fs", tool_name, time.perf_counter() - tc_t0)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result),
            })
    except (RateLimitError, AuthenticationError, PermissionDeniedError,
            APITimeoutError, BadRequestError, InternalServerError, APIConnectionError) as exc:
        err = _classify_groq_error(exc)
        logger.warning("get_llm_response | %s | user=%s | %s", err["code"], user.id, exc)
        return err["detail"]
        raise RuntimeError(err["detail"]) from exc


# ── Streaming (used by web SSE endpoint) ─────────────────────────────────────

async def stream_response(
    recent_messages: list[dict],
    memories: str,
    user: User,
    db: Session,
    api_key: str,
    source: str = "web",
) -> AsyncGenerator[dict, None]:
    """
    Single-pass streaming agent loop.

    - If the model calls tools, executes them (non-streamed), then streams
      the final response — only 1 streaming call even with tools.
    - If no tools are needed, streams the response immediately (1 call total).

    Event shapes:
      {"type": "status", "phase": "thinking" | "streaming" | "done"}
      {"type": "delta",  "text": "<token>"}
      {"type": "error",  "detail": "<message>"}
    """
    client = AsyncGroq(api_key=api_key)
    messages = _build_system_messages(user, source=source) + recent_messages
    total_t0 = time.perf_counter()
    loop_count = 0

    yield {"type": "status", "phase": "thinking"}

    try:
        # ── Tool-use pass (non-streaming, only if tools are called) ──────────
        while True:
            # First, do a non-streaming probe to detect tool calls
            loop_count += 1
            t0 = time.perf_counter()
            probe = await client.chat.completions.create(
                model=settings.MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )
            logger.info("stream_response | probe #%d | user=%s | took=%.3fs", loop_count, user.id, time.perf_counter() - t0)

            assistant_message = probe.choices[0].message
            tool_calls = assistant_message.tool_calls

            if not tool_calls:
                # No tools needed — break and stream a fresh final response
                break

            # Execute tool calls, append results, and loop back
            messages.append(assistant_message)
            for tool_call in tool_calls:
                tool_name = tool_call.function.name
                arguments = json.loads(tool_call.function.arguments)
                tc_t0 = time.perf_counter()
                logger.info("stream_response | tool=%s | user=%s | starting", tool_name, user.id)
                tool_result = execute_tool(
                    tool_name=tool_name,
                    user=user,
                    db=db,
                    arguments=arguments,
                )
                logger.info("stream_response | tool=%s | user=%s | took=%.3fs", tool_name, user.id, time.perf_counter() - tc_t0)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result),
                })

        # ── Final streaming response ──────────────────────────────────────────
        # At this point messages contains all tool results (if any).
        # Stream the final answer in one shot.
        stream_t0 = time.perf_counter()
        stream = await client.chat.completions.create(
            model=settings.MODEL,
            messages=messages,
            stream=True,
        )

        first_token = True
        token_count = 0
        async for chunk in stream:
            delta = chunk.choices[0].delta
            token = delta.content or ""
            if token:
                token_count += 1
                if first_token:
                    logger.info(
                        "stream_response | first token | user=%s | time_to_first=%.3fs",
                        user.id, time.perf_counter() - stream_t0,
                    )
                    yield {"type": "status", "phase": "streaming"}
                    first_token = False
                yield {"type": "delta", "text": token}

    except (RateLimitError, AuthenticationError, PermissionDeniedError,
            APITimeoutError, BadRequestError, InternalServerError, APIConnectionError) as exc:
        err = _classify_groq_error(exc)
        logger.warning("stream_response | %s | user=%s | %s", err["code"], user.id, exc)
        yield err
        return
    except Exception as exc:
        logger.exception("stream_response | unexpected error | user=%s", user.id)
        yield {"type": "error", "code": "unknown_error", "detail": str(exc)}
        return

    logger.info(
        "stream_response | done | user=%s | probes=%d | tokens=%d | total=%.3fs",
        user.id, loop_count, token_count, time.perf_counter() - total_t0,
    )
    yield {"type": "status", "phase": "done"}
