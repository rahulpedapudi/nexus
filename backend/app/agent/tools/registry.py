from app.services import memory_service
from app.models.user import User
from sqlalchemy.orm import Session

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_memories",
            "description": "Retrieve relevant things already known about the user by searching their memory. Use this before answering questions about the user's preferences, habits, or personal details — or whenever past context would improve your response.",
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
    },
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Save new memories about the user. Only call this when you have discovered something important and persistent about the user that they haven't explicitly asked you to remember. Use this to build a long-term profile of the user, not for ephemeral context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "A clear, concise sentence describing the memory. Start with 'User' and phrase it as a statement of fact."
                    },
                    "category": {
                        "type": "string",
                        "enum": ["preference", "fact", "pattern", "habit"],
                        "description": "The category of memory (preference | fact | pattern | habit)"
                    }
                },
                "required": ["content", "category"]
            }
        }
    }

]

def _search_memories_tool(db: Session, user: User, query: str):
    memories = memory_service.search_memories(db, user, query)
    if not memories:
        return "No memories found"
    return [{"content": m.content, "category": m.category} for m in memories]

def _save_memory_tool(db: Session, user: User, content: str, category: str):
    return memory_service.store_memory(content, category, "on-demand", db, user)

AVAILABALE_TOOLS = {
    "search_memories": _search_memories_tool,
    "save_memory": _save_memory_tool
}