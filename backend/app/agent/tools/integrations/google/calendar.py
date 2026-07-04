"""
Google Calendar service.

Single entry point for all Calendar API interactions.
Auto-refreshes the stored OAuth token if it has expired before
making any API call, and persists the new token back to the DB.
"""
import os
import logging
from datetime import datetime
from googleapiclient.discovery import build
from sqlalchemy.orm import Session


from app.models.user import User
from app.agent.tools.registry import registry
from app.agent.tools.integrations.google.auth import get_credentials
from app.services.google.google_calendar_service import create_event

logger = logging.getLogger(__name__)


def get_calendar_service(db: Session, user_id):
    """
    Return an authorized Google Calendar API v3 resource for *user_id*.

    Usage:
        service = get_calendar_service(db, current_user.id)
        events = service.events().list(calendarId='primary').execute()
    """
    creds = get_credentials(db, user_id)
    return build("calendar", "v3", credentials=creds)


def tool_create_event(db: Session, user: User, summary: str, description: str, start_time: datetime, end_time: datetime = None):
    service = get_calendar_service(db, user.id)
    event = create_event(service, summary, description, start_time, end_time)
    return event


# Schemas
_CREATE_EVENT_SCHEMA = {
    "type": "function",
    "function": {
        "name": "create_event_in_google_calendar",
        "description": "Create an event in the user's Google Calendar. This tool should be used when the user wants to create an event in their Google Calendar. You MUST use this tool if the user mentions their Google Calendar.",
        "parameters": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "The summary or title of the event."
                },
                "description": {
                    "type": "string",
                    "description": "The description of the event."
                },
                "start_time": {
                    "type": "string",
                    "description": "The start time of the event in ISO 8601 format."
                },
                "end_time": {
                    "type": "string",
                    "description": "The end time of the event in ISO 8601 format."
                }
            },
            "required": [
                "summary",
                "description",
                "start_time",
            ]
        }
    }
}


def register():
    registry.register(_CREATE_EVENT_SCHEMA, tool_create_event)
