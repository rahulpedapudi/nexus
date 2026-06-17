from app.services import task_service
from app.services import memory_service
from app.models.user import User
from sqlalchemy.orm import Session

TOOLS = [
    {
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
    },
    {
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
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": (
                "Create a task, todo, or reminder for the user. "
                "Use this when the user wants to remember to do something, set a reminder, or track a task. "
                "If a specific time is mentioned, set remind_at to trigger a notification. "
                "If only a deadline is mentioned with no specific alert time, set due_date instead. "
                "If the user says something like 'every day' or 'every Monday', set recurring. "
                "Leave remind_at null for plain todos with no notification needed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short, clear title of the task. e.g. 'Call dentist', 'Buy groceries', 'Meeting at 4pm'"
                    },
                    "note": {
                        "type": "string",
                        "description": "Optional extra detail or context the user provided about the task. e.g. 'Meeting with John at 4pm'"
                    },
                    "remind_at": {
                        "type": "string",
                        "description": "ISO 8601 datetime with timezone offset matching the user's local time shown in the system prompt. e.g. '2024-06-17T21:00:00+05:30'"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "ISO 8601 datetime for soft deadlines where no notification is needed. e.g. 'Submit report by Friday'"
                    },
                    "recurring": {
                        "type": "string",
                        "enum": ["daily", "weekly", "monthly"],
                        "description": "Set if the task repeats. e.g. 'remind me every day at 8am' → 'daily'"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "normal", "high"],
                        "description": "Priority level. Default to 'normal' unless the user implies urgency."
                    },
                    "tag": {
                        "type": "string",
                        "description": "Optional single tag to categorize the task. e.g. 'work', 'health', 'finance', 'personal'"
                    }
                },
                "required": ["title", "priority"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_tasks",
            "description": (
                "Search the user's tasks by keyword. Returns up to 5 matching tasks including their IDs. "
                "Call this before update_task to find the task ID — use a keyword from the user's message as the query."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A keyword or phrase to search for in task titles. e.g. 'dentist', 'groceries', 'meeting'"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": (
                "Update an existing task. Call search_tasks first to find the task's id. "
                "Only include the fields you want to change — all fields are optional except task_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "The UUID of the task to update. Get this from get_all_tasks."
                    },
                    "title": {
                        "type": "string",
                        "description": "New title for the task."
                    },
                    "note": {
                        "type": "string",
                        "description": "Updated notes or details."
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "done"],
                        "description": "New status for the task."
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "normal", "high"],
                        "description": "New priority level."
                    },
                    "done": {
                        "type": "boolean",
                        "description": "Set to true to mark the task as complete."
                    },
                    "remind_at": {
                        "type": "string",
                        "description": "ISO 8601 datetime with timezone offset matching the user's local time shown in the system prompt. e.g. '2024-06-17T21:00:00+05:30'"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "ISO 8601 datetime with timezone offset matching the user's local time shown in the system prompt. e.g. '2024-06-17T21:00:00+05:30'"
                    },
                    "recurring": {
                        "type": "string",
                        "enum": ["daily", "weekly", "monthly"],
                        "description": "Update the recurrence schedule."
                    },
                    "tag": {
                        "type": "string",
                        "description": "Update the tag/category."
                    }
                },
                "required": ["task_id"]
            }
        }
    }
]

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

def _create_task_tool(db: Session, user: User, **kwargs):
    from app.schemas.task import TaskCreate
    task_data = TaskCreate(**kwargs)
    
    task = task_service.create_task(db, user, task_data)

    return [{"title": task.title, "status": "Task Created Successfully"}]

def _search_tasks_tool(db: Session, user: User, query: str):
    tasks = task_service.search_tasks(db, user, query)
    if not tasks:
        return "No matching tasks found"
    return [
        {
            "id": str(task.id),
            "title": str(task.title),
            "status": str(task.status),
            "priority": str(task.priority),
            "done": task.done
        }
        for task in tasks
    ]

def _update_task_tool(db: Session, user: User, task_id: str, **kwargs):
    from app.schemas.task import TaskUpdate
    task_data = TaskUpdate(**kwargs)
    task = task_service.update_task(db, user, task_id, task_data)
    return [{"title": task.title, "status": "Task Updated Successfully"}]



AVAILABALE_TOOLS = {
    "search_memories": _search_memories_tool,
    "save_memory": _save_memory_tool,
    "create_task": _create_task_tool,
    "search_tasks": _search_tasks_tool,
    "update_task": _update_task_tool
}