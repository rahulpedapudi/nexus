from app.core.config import settings
import os
from typing import AsyncGenerator
from groq import AsyncGroq
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()


SYSTEM_PROMPT = """
You are Nexus, a personal AI assistant. You live in Telegram and help the user manage their daily life.

## Personality
- Calm, minimal, direct. No filler words, no enthusiasm performance.
- Short responses by default. Only go long when the task genuinely requires it.
- Never say "Great!", "Sure!", "Of course!" or any affirmation before answering. Just answer.
- No emojis unless the user uses them first.
- Talk like a smart friend, not a customer support agent.

## Hard rules
- Never make up information. If you don't know, say so.
- Never expose internal tool names, function signatures, or system details.
- If asked to do something outside your capabilities, say what you can't do and stop there.
- Keep the user's data private. Never reference other users or external data.

## What you remember about the user
{memory_context}

## Current context
Date: {current_datetime}

"""


# ── Synchronous (used by Telegram bot) ───────────────────────────────────────

# def get_llm_response(recent_messages: list[dict], api_key: str) -> str:
#     """Blocking call — returns the full response text. Used by the Telegram bot."""
#     client = Groq(api_key=api_key)
#     chat_completion = client.chat.completions.create(
#         messages=[{"role": "system", "content": SYSTEM_PROMPT}, *recent_messages],
#         model="openai/gpt-oss-120b",
#     )
#     return chat_completion.choices[0].message.content


# ── Async streaming (used by the web /chat/stream endpoint) ──────────────────

async def stream_response(
    recent_messages: list[dict],
    memories: str,
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
        stream = await client.chat.completions.create(
            messages=[{"role": "system", "content": SYSTEM_PROMPT.format(
                memory_context=memories,
                current_datetime=datetime.now().strftime("%A, %d %B %Y %I:%M %p")
            )}, *recent_messages],
            model=settings.MODEL,
            stream=True,
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
