from app.services import memory_service
from app.models.user import User
from sqlalchemy.orm import Session
from groq import AsyncGroq
import json
import logging
import time

from app.core.config import settings
from app.agent.prompts import EXTRACTION_PROMPT

logger = logging.getLogger(__name__)


async def extract_memories(
    user_msg: str,
    assistant_msg: str,
    user: User,
    db: Session,
    api_key: str,
) -> list[dict]:
    """
    Async memory extraction — uses AsyncGroq so it doesn't block the event loop.
    Returns a list of {"content": ..., "category": ...} dicts.
    """
    client = AsyncGroq(api_key=api_key)

    memories = memory_service.list_all_memories(db, user)
    past_memories_str = "\n".join([f"- {m.content}" for m in memories])

    t0 = time.perf_counter()
    response = await client.chat.completions.create(
        model=settings.GROQ_DEFAULT_MODEL,
        messages=[
            {
                "role": "system",
                "content": EXTRACTION_PROMPT + f"""
                    Already known about this user (do NOT re-extract these):
                    {past_memories_str if past_memories_str else "Nothing yet."}
                """,
            },
            {
                "role": "user",
                "content": (
                    f"Conversation:\nUser: {user_msg}\n"
                    f"Assistant: {assistant_msg}\nExtract Memories:"
                ),
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "memories",
                "schema": {
                    "type": "object",
                    "properties": {
                        "memories": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "content": {"type": "string"},
                                    "category": {
                                        "type": "string",
                                        "enum": ["preference", "fact", "pattern", "habit"],
                                    },
                                },
                                "required": ["content", "category"],
                            },
                        }
                    },
                    "required": ["memories"],
                },
            },
        },
    )

    raw = response.choices[0].message.content
    parsed = json.loads(raw)
    memories = parsed.get("memories", [])
    logger.info(
        "extract_memories | user=%s | extracted=%d | took=%.3fs",
        user.id, len(memories), time.perf_counter() - t0,
    )
    return memories
