from app.agent.tools.registry import registry
from app.services.todoist.todoist_service import fetch_tasks, create_task


def tool_fetch_tasks(db, user, filter_string: str = "today"):
    return fetch_tasks(db, user, filter_string)


def tool_create_task(db, user, text: str, note: str = None, reminder: str = None):
    return create_task(db, user, text, note, reminder)


_FETCH_TASKS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "fetch_tasks",
        "description": (
            "Retrieve tasks from Todoist using Todoist's filter language. "
            "Returns task metadata including the task ID, title, description, due date, "
            "recurrence status, completion status, creation time, completion time, and priority. "
            "Use this function whenever the user wants to view, search, list, summarize, "
            "or locate tasks before performing another action such as updating or completing one."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "filter_string": {
                    "type": "string",
                    "description": (
                        "A Todoist filter expression used to select tasks. "
                        "Supports Todoist's filter syntax.\n\n"
                        "Examples:\n"
                        "- today\n"
                        "- tomorrow\n"
                        "- overdue\n"
                        "- 7 days\n"
                        "- next 30 days\n"
                        "- p1\n"
                        "- p2\n"
                        "- p3\n"
                        "- p4\n"
                        "- today & p1\n"
                        "- today | overdue\n"
                        "- recurring\n"
                        "- !recurring\n\n"
                        "Combine filters using '&' (AND), '|' (OR), and '!' (NOT). "
                        "If omitted, defaults to 'today'."
                    ),
                    "default": "today"
                }
            },
            "required": []
        }
    }
}

_CREATE_TASK_SCHEMA = {
    "type": "function",
    "function": {
        "name": "create_task",
        "description": (
            "Create a new task in Todoist using natural language. "
            "The task text may include due dates, times, priorities, labels, projects, "
            "and recurring schedules understood by Todoist's Quick Add parser. "
            "Optionally add a note and a reminder."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": (
                        "The task to create using Todoist Quick Add syntax. "
                        "The Quick Add parser understands natural language and special syntax to set "
                        "due dates, times, recurring schedules, priorities, projects, labels, and assignees "
                        "within a single string.\n\n"

                        "Supported syntax:\n"
                        "- Plain text creates a task title.\n"
                        "- Natural language dates: today, tomorrow, tonight, next Monday, in 2 weeks.\n"
                        "- Times: 3pm, 15:00, tomorrow at 9am.\n"
                        "- Recurring tasks: every day, every Monday, every month, every year, every weekday.\n"
                        "- Priorities: p1 (highest), p2, p3, p4 (lowest).\n"
                        "- Projects: #ProjectName.\n"
                        "- Labels: @label.\n"
                        "- Multiple labels may be specified.\n"
                        "- Multiple attributes can be combined in a single string.\n\n"

                        "Examples:\n"
                        "- Buy groceries\n"
                        "- Buy groceries tomorrow\n"
                        "- Finish report tomorrow at 5pm\n"
                        "- Submit assignment next Monday 11am\n"
                        "- Review PR every Friday\n"
                        "- Backup database every day at 2am\n"
                        "- Renew passport every year\n"
                        "- Call Alice today 3pm p1\n"
                        "- Finish Nexus backend p2\n"
                        "- Prepare presentation #Work\n"
                        "- Buy milk #Personal @shopping\n"
                        "- Schedule dentist appointment next Tuesday 10am #Health @important\n"
                        "- Review pull requests every weekday 9am #Work @coding p1\n"
                        "- Pay electricity bill every month p2 #Finance\n"
                        "- Plan vacation in December #Personal @travel\n\n"

                        "Examples combining multiple features:\n"
                        "- Finish Nexus integration tomorrow 6pm p1 #Work @backend\n"
                        "- Review design doc every Monday 10am p2 #Engineering @review\n"
                        "- Call mom every Sunday 7pm #Personal\n"
                        "- Renew SSL certificate every year @infrastructure p1\n\n"

                        "Prefer expressing all task details directly in the Quick Add text whenever possible."
                    )
                },
                "note": {
                    "type": "string",
                    "description": (
                        "Optional note or additional information attached to the task."
                    )
                },
                "reminder": {
                    "type": "string",
                    "description": (
                        "Optional reminder using natural language. "
                        "Examples:\n"
                        "- 30 minutes before\n"
                        "- tomorrow 8am\n"
                        "- every weekday at 9am"
                    )
                }
            },
            "required": ["text"]
        }
    }
}


def register():
    registry.register(_FETCH_TASKS_SCHEMA, tool_fetch_tasks)
    registry.register(_CREATE_TASK_SCHEMA, tool_create_task)
