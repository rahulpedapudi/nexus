"""
Google Calendar service.

Single entry point for all Calendar API interactions.
Auto-refreshes the stored OAuth token if it has expired before
making any API call, and persists the new token back to the DB.
"""

from app.models.user import User
from app.services.google.google_calendar_service import create_event
import os
import logging
from datetime import datetime, UTC, timedelta

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from app.models.oauth_tokens import OAuthToken
from app.agent.tools.registry import registry

logger = logging.getLogger(__name__)


CLIENT_SECRETS_FILE = os.path.join(
    os.path.dirname
    (__file__), "..", "..", "..", "..", "..", "..", "credentials.json"
)

# Helpers


def _load_token(db: Session, user_id) -> OAuthToken | None:
    return (
        db.query(OAuthToken)
        .filter(OAuthToken.user_id == user_id, OAuthToken.provider == "google")
        .one_or_none()
    )


def _creds_from_token(token: OAuthToken) -> Credentials:
    """Build a google.oauth2.credentials.Credentials from our DB row."""
    scopes = token.scopes.split(",") if token.scopes else []
    return Credentials(
        token=token.access_token,
        refresh_token=token.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=_get_client_id(),
        client_secret=_get_client_secret(),
        scopes=scopes,
    )


def _get_client_id() -> str:
    import json
    with open(CLIENT_SECRETS_FILE) as f:
        data = json.load(f)
    return data["web"]["client_id"]


def _get_client_secret() -> str:
    import json
    with open(CLIENT_SECRETS_FILE) as f:
        data = json.load(f)
    return data["web"]["client_secret"]


def _is_expired(token: OAuthToken) -> bool:
    """Returns True if the token has expired or expires within 60 seconds."""
    if not token.expires_at:
        return True
    now = datetime.now(UTC)
    # expires_at may be naive if stored without timezone — normalise it
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at <= now + timedelta(seconds=60)


def _refresh_and_persist(db: Session, token: OAuthToken, creds: Credentials) -> Credentials:
    """Refresh the credentials and write the new access token back to DB."""
    logger.info("Refreshing Google OAuth token for user_id=%s", token.user_id)
    creds.refresh(GoogleRequest())

    token.access_token = creds.token
    if creds.expiry:
        # creds.expiry is a naive UTC datetime from the google library
        token.expires_at = creds.expiry.replace(tzinfo=UTC)
    token.updated_at = datetime.now(UTC)

    db.commit()
    db.refresh(token)
    return creds


def get_credentials(db: Session, user_id) -> Credentials:
    """
    Load credentials for *user_id* from the DB, refreshing them if expired.

    Raises ValueError if the user has not connected Google Calendar yet.
    """
    token = _load_token(db, user_id)
    if not token:
        raise ValueError(f"No Google OAuth token found for user_id={user_id}. "
                         "User must connect Google Calendar first.")

    creds = _creds_from_token(token)

    if _is_expired(token):
        if not creds.refresh_token:
            raise ValueError("Token expired and no refresh token available. "
                             "User must re-connect Google Calendar.")
        creds = _refresh_and_persist(db, token, creds)

    return creds


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
                "start_time",
            ]
        }
    }
}


def register():
    registry.register(_CREATE_EVENT_SCHEMA, tool_create_event)
