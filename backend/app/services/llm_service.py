from sqlalchemy.orm import Session
from app.models.user import User
from app.core.config import settings
from typing import AsyncGenerator
from groq import AsyncGroq
from dotenv import load_dotenv
from datetime import datetime
import json
import logging

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools.registry import TOOLS
from app.agent.tools.tool_executor import execute_tool

load_dotenv()
logger = logging.getLogger(__name__)


def _build_system_messages(user: User, memories: str = "") -> list[dict]:
    return [
        {
            "role": "system",
            "content": SYSTEM_PROMPT.format(
                current_datetime=datetime.now().strftime("%A, %d %B %Y %I:%M %p"),
                user_name=user.username,
            ),
        }
    ]


# ── Non-streaming (used by Discord) ──────────────────────────────────────────

async def get_llm_response(
    recent_messages: list[dict],
    memories: str,
    api_key: str,
    db: Session,
    user: User,
) -> str:
    """Single-pass agent loop for Discord — returns the full response text."""
    client = AsyncGroq(api_key=api_key)
    messages = _build_system_messages(user) + recent_messages

    while True:
        response = await client.chat.completions.create(
            model=settings.MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        assistant_message = response.choices[0].message
        tool_calls = assistant_message.tool_calls

        if not tool_calls:
            # No tools needed — return text directly (single LLM call)
            return assistant_message.content or ""

        # Execute tool calls and loop
        messages.append(assistant_message)
        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)
            tool_result = execute_tool(
                tool_name=tool_name,
                user=user,
                db=db,
                arguments=arguments,
            )
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result),
            })


# ── Streaming (used by web SSE endpoint) ─────────────────────────────────────

async def stream_response(
    recent_messages: list[dict],
    memories: str,
    user: User,
    db: Session,
    api_key: str,
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
    messages = _build_system_messages(user) + recent_messages

    yield {"type": "status", "phase": "thinking"}

    try:
        # ── Tool-use pass (non-streaming, only if tools are called) ──────────
        while True:
            # First, do a non-streaming probe to detect tool calls
            probe = await client.chat.completions.create(
                model=settings.MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )

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
                logger.info(f"Executing tool: {tool_name}")
                tool_result = execute_tool(
                    tool_name=tool_name,
                    user=user,
                    db=db,
                    arguments=arguments,
                )
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result),
                })

        # ── Final streaming response ──────────────────────────────────────────
        # At this point messages contains all tool results (if any).
        # Stream the final answer in one shot.
        stream = await client.chat.completions.create(
            model=settings.MODEL,
            messages=messages,
            stream=True,
        )

        first_token = True
        async for chunk in stream:
            delta = chunk.choices[0].delta
            token = delta.content or ""
            if token:
                if first_token:
                    yield {"type": "status", "phase": "streaming"}
                    first_token = False
                yield {"type": "delta", "text": token}

    except Exception as exc:
        logger.exception("stream_response error")
        yield {"type": "error", "detail": str(exc)}
        return

    yield {"type": "status", "phase": "done"}
