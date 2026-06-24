from app.services import memory_service
from app.models.user import User
from sqlalchemy.orm import Session
from app.agent.tools.registry import registry


def _search_memories_tool(db: Session, user: User, query: str):
    memories = memory_service.search_memories(db, user, query)
    if not memories:
        return "No memories found"
    return [{"content": m.content, "category": m.category} for m in memories]


def _save_memory_tool(db: Session, user: User, memories: list = None):

    if not memories:
        return []

    results = []
    for memory in memories:
        results.append(memory_service.store_memory(
            content=memory["content"],
            category=memory["category"],
            source="on-demand",
            db=db,
            user=user
        ))

    # store_memory returns None if memory already exists (due to duplicate check)
    # so we filter out the None values
    saved = [m for m in results if m is not None]

    if not saved:
        return "No new memories saved"
    return [{"content": m.content, "category": m.category} for m in saved]


# Schemas

_SEARCH_SCHEMA = {
    "type": "function",
    "function": {
            "name": "search_memories",
            "description": "Retrieve relevant things already known about the user by searching their memory. Use this whenever past context would improve your response.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Your query, phrased naturally as you would ask it. Do NOT include 'remember' or 'recall' or 'memory' in the query."
                    }
                },
                "required": ["query"]
            }
    }
}


_SAVE_SCHEMA = {
    "type": "function",
    "function": {
            "name": "save_memory",
            "description": "Save new memories about the user. Only call this when you have discovered something important and persistent about the user that they haven't explicitly asked you to remember. Use this to build a long-term profile of the user, not for ephemeral context. The function takes an array of memory objects as input. Categories: preference | fact | pattern | habit | goal | interest.",
            "parameters": {
                "type": "object",
                "properties": {
                    "memories": {
                        "type": "array",
                        "description": "List of memory objects to save. Example: [{content: 'User likes coffee', category: 'preference'}, {content: 'User has a cat', category: 'fact'}]",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "A clear, concise sentence describing the memory. Start with 'User' and phrase it as a statement of fact."
                                },
                                "category": {
                                    "type": "string",
                                    "enum": ["preference", "fact", "pattern", "habit", "goal", "interest"],
                                    "description": "The category of memory (preference | fact | pattern | habit | goal | interest)"
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


def register():
    registry.register(
        schema=_SEARCH_SCHEMA,
        handler=_search_memories_tool
    )

    registry.register(
        schema=_SAVE_SCHEMA,
        handler=_save_memory_tool
    )
