import requests
from app.core.config import settings
from app.core.credentials import creds_store

TODOIST_API_TOKEN = creds_store.get("todoist").get("token")
TODOIST_BASE_URL = settings.TODOIST_URL

headers = {
    "Authorization": f"Bearer {TODOIST_API_TOKEN}"
}


def fetch_tasks(db, user, filter_string: str = "today"):
    """
     Fetches tasks from Todoist.

    Args:
        filter_string (str): The filter string to apply to the tasks.

    Returns:
        list: The list of tasks.
        [
            {
                "id": "6h3QVP9C2GcG5mH6",
                "content": "search for major project ideas",
                "description": "",
                "due_date": "2026-07-05",
                "is_recurring": false,
                "checked": false,
                "added_at": "2026-07-05T08:51:45.897005Z",
                "completed_at": null,
                "priority": 1,
            }
        ]
    """

    url = f"{TODOIST_BASE_URL}/tasks/filter?query={filter_string}"
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"Error fetching tasks: {response.text}")

    data = response.json()

    tasks = []
    for task in data["results"]:
        tasks.append({
            "id": task["id"],
            "content": task["content"],
            "description": task["description"],
            "due_date": task["due"]["date"],
            "is_recurring": task["due"]["is_recurring"],
            "checked": task["checked"],
            "added_at": task["added_at"],
            "completed_at": task["completed_at"],
            "priority": task["priority"],
        })

    return tasks


def create_task(db, user, text: str, note: str = None, reminder: str = None):
    url = f"{TODOIST_BASE_URL}/tasks/quick"

    payload = {
        "text": text,
        "note": note,
        "reminder": reminder,
        "auto_reminder": True,
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        raise Exception(f"Error creating task: {response.text}")

    return response.json()
