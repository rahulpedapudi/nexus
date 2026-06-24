from app.services import task_service
from app.models.user import User
from sqlalchemy.orm import Session

from app.agent.tools.registry import registry


def _fmt_dt(dt) -> str | None:
    """Convert a UTC-aware datetime from the DB to local time for LLM consumption."""
    if dt is None:
        return None
    from datetime import timezone
    # Ensure dt is timezone-aware (SQLAlchemy returns UTC-aware for TIMESTAMPTZ)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Convert to the server's local timezone so the LLM sees wall-clock time
    return dt.astimezone().isoformat()


def _create_task_tool(db: Session, user: User, **kwargs):
    from app.schemas.task import TaskCreate
    task_data = TaskCreate(**kwargs)

    task = task_service.create_task(db, user, task_data)

    return [{"title": task.title, "status": "Task Created Successfully"}]


def _search_tasks_tool(
    db: Session,
    user: User,
    query: str = None,
    status: str = None,
    priority: str = None,
    tag: str = None,
    done: bool = None,
    due_after: str = None,
    due_before: str = None,
    remind_after: str = None,
    remind_before: str = None,
    limit: int = 20,
):
    from datetime import datetime

    def _parse_dt(value):
        return datetime.fromisoformat(value) if value else None

    tasks = task_service.search_tasks(
        db=db,
        user=user,
        query=query,
        status=status,
        priority=priority,
        tag=tag,
        done=done,
        due_after=_parse_dt(due_after),
        due_before=_parse_dt(due_before),
        remind_after=_parse_dt(remind_after),
        remind_before=_parse_dt(remind_before),
        limit=limit,
    )
    if not tasks:
        return "No matching tasks found"
    return [
        {
            "id": str(task.id),
            "title": str(task.title),
            "status": str(task.status),
            "priority": str(task.priority),
            "tag": str(task.tag),
            "done": task.done,
            "due_date": _fmt_dt(task.due_date),
            "remind_at": _fmt_dt(task.remind_at),
        }
        for task in tasks
    ]


def _update_task_tool(db: Session, user: User, task_id: str, **kwargs):
    from app.schemas.task import TaskUpdate
    task_data = TaskUpdate(**kwargs)
    task = task_service.update_task(db, user, task_id, task_data)
    return [{"title": task.title, "status": "Task Updated Successfully"}]


def _get_all_tasks_tool(db: Session, user: User):
    tasks = task_service.get_tasks(db, user)
    if not tasks:
        return "No tasks found"
    return [
        {
            "id": str(task.id),
            "title": str(task.title),
            "note": str(task.note),
            "remind_at": _fmt_dt(task.remind_at),
            "due_date": _fmt_dt(task.due_date),
            "recurring": str(task.recurring),
            "priority": str(task.priority),
            "tag": str(task.tag),
            "done": task.done
        }
        for task in tasks
    ]


_CREATE_TASK_SCHEMA = {
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
}

_SEARCH_TASKS_SCHEMA = {
    "type": "function",
    "function": {
            "name": "search_tasks",
            "description": (
                "Search or filter the user's tasks. All parameters are optional and combinable. "
                "Use 'query' for keyword lookup (searches title and note). "
                "Use the filter fields to narrow by status, priority, tag, completion state, deadline, or reminder time. "
                "Always call this before update_task to find the task ID."
            ),
        "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Keyword or phrase to search in task title or note. e.g. 'dentist', 'groceries'"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "done"],
                        "description": "Filter by task status."
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "normal", "high"],
                        "description": "Filter by priority level."
                    },
                    "tag": {
                        "type": "string",
                        "description": "Filter by tag/category. e.g. 'work', 'health', 'personal'"
                    },
                    "done": {
                        "type": "boolean",
                        "description": "Filter by completion state. true = completed, false = incomplete."
                    },
                    "due_after": {
                        "type": "string",
                        "description": "Return tasks with due_date on or after this ISO 8601 datetime. e.g. '2026-06-17T00:00:00+05:30'"
                    },
                    "due_before": {
                        "type": "string",
                        "description": "Return tasks with due_date on or before this ISO 8601 datetime."
                    },
                    "remind_after": {
                        "type": "string",
                        "description": "Return tasks with remind_at on or after this ISO 8601 datetime. Useful to find upcoming reminders."
                    },
                    "remind_before": {
                        "type": "string",
                        "description": "Return tasks with remind_at on or before this ISO 8601 datetime."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return. Defaults to 20, max 100."
                    }
                },
                "required": []
                }
    }
}

_UPDATE_TASK_SCHEMA = {
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

_GET_TASKS_SCHEMA = {
    "type": "function",
    "function": {
            "name": "get_all_tasks",
            "description": "Get all tasks",
    }
}


def register():
    registry.register(schema=_CREATE_TASK_SCHEMA, handler=_create_task_tool)
    registry.register(schema=_SEARCH_TASKS_SCHEMA, handler=_search_tasks_tool)
    registry.register(schema=_UPDATE_TASK_SCHEMA, handler=_update_task_tool)
    registry.register(schema=_GET_TASKS_SCHEMA, handler=_get_all_tasks_tool)
