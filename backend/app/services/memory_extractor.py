from app.services import memory_service
from app.models.user import User
from sqlalchemy.orm import Session
from groq import Groq
import json

from app.core.config import settings


EXTRACTION_PROMPT = """
    You are a memory extraction system. Given a conversation exchange, extract facts worth remembering about the user long-term.
    Rules:
    - Only extract persistent facts — preferences, habits, recurring patterns, personal details
    - Ignore one-off requests, questions, or temporary context
    - Each memory should be a single clear sentence starting with "User"
    - Return JSON array of objects: [{"content": "...", "category": "preference|fact|pattern|habit"}]
    - Return empty array [] if nothing worth remembering
    - Never extract sensitive data like passwords or payment details

    Examples of good memories:
    - "User is vegetarian"
    - "User prefers morning reminders"
    - "User's rent is due on the 1st of every month"
    - "User tracks expenses in INR"

    Examples of bad memories (don't extract):
    - "User asked what the weather is"
    - "User said okay"
    - "User wants a reminder for today"

    Conversation:
    User: "What is the weather?"
    Assistant: "It is sunny today"
    Extract Memories:
    []

    User: "I am going to the gym at 5pm"
    Assistant: "Got it"
    Extract Memories:
    [{"content": "User goes to the gym at 5pm", "category": "habit"}]
"""

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
    
