import json
import logging
import time
from typing import AsyncGenerator
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.models.user import User

from app.agent.prompts import SYSTEM_PROMPT, DISCORD_FORMAT_ADDENDUM, TELEGRAM_ADDENDUM

from app.agent.llms import build_llm_provider, LLMError

from app.agent.tools.registry import registry


load_dotenv()
logger = logging.getLogger(__name__)


# Provider singleton
def get_provider():
    _provider = build_llm_provider()
    return _provider


def _build_system_messages(user: User, source: str = "web") -> list[dict]:
    content = SYSTEM_PROMPT.format(
        current_datetime=datetime.now().astimezone().strftime("%A, %d %B %Y %I:%M %p %z"),
        user_name=user.username,
    )
    if source == "discord":
        content += DISCORD_FORMAT_ADDENDUM
    elif source == "telegram":
        content += TELEGRAM_ADDENDUM
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
    # api_key: str,
    db: Session,
    user: User,
    source: str = "web",
) -> str:
    """Single-pass agent loop for Discord — returns the full response text."""

    messages = _build_system_messages(user, source=source) + recent_messages
    total_t0 = time.perf_counter()
    loop_count = 0

    _provider = get_provider()

    try:
        while True:
            loop_count += 1
            t0 = time.perf_counter()

            response = await _provider.complete(
                messages=messages,
                tools=registry.schemas,
                # model=settings.MODEL,
            )

            logger.info("get_llm_response | probe #%d | took=%.3fs",
                        loop_count, time.perf_counter() - t0)

            assistant_message = response.msg
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
            messages.append(assistant_message.to_dict())

            for tool_call in tool_calls:
                tc_t0 = time.perf_counter()

                tool_name = tool_call.name
                arguments = json.loads(tool_call.arguments)

                tool_result = registry.execute(
                    tool_name=tool_name,
                    user=user,
                    db=db,
                    arguments=arguments,
                )

                logger.info("get_llm_response | tool=%s | took=%.3fs",
                            tool_name, time.perf_counter() - tc_t0)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result),
                })
    except LLMError as exc:
        logger.warning("get_llm_response | %s | user=%s | %s",
                       exc.code, user.id, exc.detail)
        return exc.detail


# ── Streaming (used by web SSE endpoint) ─────────────────────────────────────

async def stream_response(
    recent_messages: list[dict],
    memories: str,
    user: User,
    db: Session,
    # api_key: str,
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

    messages = _build_system_messages(user, source=source) + recent_messages

    total_t0 = time.perf_counter()
    loop_count = 0

    _provider = get_provider()

    yield {"type": "status", "phase": "thinking"}

    try:
        # ── Tool-use pass (non-streaming, only if tools are called) ──────────
        while True:
            # First, do a non-streaming probe to detect tool calls
            loop_count += 1
            t0 = time.perf_counter()

            probe = await _provider.complete(messages=messages, tools=registry.schemas)

            logger.info("stream_response | probe #%d | user=%s | took=%.3fs",
                        loop_count, user.id, time.perf_counter() - t0)

            assistant_message = probe.msg
            tool_calls = assistant_message.tool_calls

            logger.info("assistant_message | %s", assistant_message)
            logger.info("tool_calls | %s", tool_calls)

            if not tool_calls:
                # No tools needed — break and stream a fresh final response
                break

            # Execute tool calls, append results, and loop back
            messages.append(assistant_message.to_dict())

            for tool_call in tool_calls:
                tc_t0 = time.perf_counter()

                tool_name = tool_call.name
                arguments = json.loads(tool_call.arguments)

                logger.info(
                    "stream_response | tool=%s | user=%s | starting", tool_name, user.id)

                tool_result = registry.execute(
                    tool_name=tool_name,
                    user=user,
                    db=db,
                    arguments=arguments,
                )

                logger.info("stream_response | tool=%s | user=%s | took=%.3fs",
                            tool_name, user.id, time.perf_counter() - tc_t0)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result),
                })

        # ── Final streaming response ──────────────────────────────────────────
        # At this point messages contains all tool results (if any).
        # Stream the final answer in one shot.
        stream_t0 = time.perf_counter()

        # stream = await client.chat.completions.create(
        #     model=settings.MODEL,
        #     messages=messages,
        #     stream=True,
        # )

        first_token = True
        token_count = 0

        async for token in _provider.stream(messages=messages):
            token_count += 1

            if first_token:
                logger.info(
                    "stream_response | first token | user=%s | time_to_first=%.3fs",
                    user.id, time.perf_counter() - stream_t0,
                )

                yield {"type": "status", "phase": "streaming"}
                first_token = False

            yield {"type": "delta", "text": token}

    except LLMError as exc:
        logger.warning("stream_response | %s | user=%s | %s",
                       exc.code, user.id, exc.detail)
        yield {"type": "error", "code": exc.code, "detail": exc.detail}
        return

    except Exception as exc:
        logger.exception(
            "stream_response | unexpected error | user=%s", user.id)
        yield {"type": "error", "code": "unknown_error", "detail": str(exc)}
        return

    logger.info(
        "stream_response | done | user=%s | probes=%d | tokens=%d | total=%.3fs",
        user.id, loop_count, token_count, time.perf_counter() - total_t0,
    )
    yield {"type": "status", "phase": "done"}
