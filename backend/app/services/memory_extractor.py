from app.services import memory_service
from app.models.user import User
from sqlalchemy.orm import Session
from groq import Groq
import json

from app.core.config import settings

from app.agent.prompts import EXTRACTION_PROMPT


def extract_memories(user_msg: str, assistant_msg: str, user: User, db: Session, api_key: str):
    
    client = Groq(api_key=api_key)

    memories = memory_service.list_all_memories(db, user)
    past_memories_str = "\n".join([f"- {m.content}" for m in memories])

    response = client.chat.completions.create(
        model=settings.MODEL,
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT + f"""
                Already known about this user (do NOT re-extract these):
                {past_memories_str if past_memories_str else "Nothing yet."}
            """},
            {"role": "user", "content": f"Conversation:\nUser: {user_msg}\nAssistant: {assistant_msg}\nExtract Memories:"}
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
                                        "enum": ["preference", "fact", "pattern", "habit"]
                                    }
                                },
                                "required": ["content", "category"]
                            }
                        }
                    },
                    "required": ["memories"]
                }
            }
        }
    )


    raw = response.choices[0].message.content
    parsed = json.loads(raw)
    return parsed.get("memories", [])
    
