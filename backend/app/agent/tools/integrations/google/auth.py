import os
import socket
import logging
from pathlib import Path

from app.core.paths import get_nexus_home
from datetime import datetime, UTC
from urllib.parse import urlparse
from wsgiref import simple_server
from datetime import datetime, UTC, timedelta


from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest

# These internal helpers mirror what run_local_server() uses internally.
# They provide a minimal WSGI app that captures the redirect and a silent
# request handler. If google-auth-oauthlib ever removes them, see the note
# at the bottom of this file for a hand-rolled replacement.
# type: ignore[attr-defined]
from google_auth_oauthlib.flow import _RedirectWSGIApp, _WSGIRequestHandler

from app.models.user import User
from app.models.oauth_tokens import OAuthToken


logger = logging.getLogger(__name__)

# Allow HTTP for local development (remove in production)
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

CLIENT_SECRETS_FILE = get_nexus_home() / "google-credentials.json"

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _free_port() -> int:
    """Ask the OS for a free TCP port."""
    with socket.socket() as s:
        s.bind(("localhost", 0))
        return s.getsockname()[1]


def _make_flow(redirect_uri: str) -> InstalledAppFlow:
    """
    Build an InstalledAppFlow from the desktop-type credentials file.
    The credentials.json must have an "installed" key (Desktop app client ID).
    """
    flow = InstalledAppFlow.from_client_secrets_file(
        CLIENT_SECRETS_FILE, SCOPES)
    flow.redirect_uri = redirect_uri
    return flow


def _upsert_token(db: Session, user_id, token_data: dict) -> OAuthToken:
    """Insert or update the OAuthToken row for this user + provider."""
    token = (
        db.query(OAuthToken)
        .filter(OAuthToken.user_id == user_id, OAuthToken.provider == "google")
        .one_or_none()
    )

    scopes_str = ",".join(token_data.get("scopes", []))

    # Parse expiry — google returns a datetime object via the Flow
    expires_at = token_data.get("expiry")  # datetime | None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if token is None:
        token = OAuthToken(
            user_id=user_id,
            provider="google",
            access_token=token_data["token"],
            refresh_token=token_data.get("refresh_token"),
            id_token=token_data.get("id_token"),
            expires_at=expires_at,
            scopes=scopes_str,
        )
        db.add(token)
    else:
        token.access_token = token_data["token"]
        if token_data.get("refresh_token"):
            # Google only returns refresh_token on the first authorization;
            # preserve the existing one if absent.
            token.refresh_token = token_data["refresh_token"]
        token.id_token = token_data.get("id_token")
        token.expires_at = expires_at
        token.scopes = scopes_str
        token.updated_at = datetime.now(UTC)

    db.commit()
    db.refresh(token)
    return token


# ---------------------------------------------------------------------------
# Two-phase OAuth — Phase 1: build URL
# ---------------------------------------------------------------------------

def build_auth_url() -> tuple[str, InstalledAppFlow]:
    """
    Phase 1 of the OAuth flow.

    Picks a free OS port, creates the flow with a matching redirect URI, and
    generates the Google consent URL — all without any blocking I/O.

    Returns:
        auth_url:  The Google consent screen URL to show the user.
        flow:      The configured flow object (pass to ``wait_for_code``).
    """
    port = _free_port()
    redirect_uri = f"http://localhost:{port}/"
    flow = _make_flow(redirect_uri)

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )

    logger.info(
        "Google OAuth: generated consent URL (redirect_uri=%s)", redirect_uri
    )
    return auth_url, flow


# ---------------------------------------------------------------------------
# Two-phase OAuth — Phase 2: wait for redirect & exchange code
# ---------------------------------------------------------------------------

def wait_for_code(flow: InstalledAppFlow) -> dict:
    """
    Phase 2 of the OAuth flow.

    Starts a local WSGI server on the port embedded in ``flow.redirect_uri``,
    blocks until Google redirects back with the authorization code, then
    exchanges the code for tokens.

    This is designed to run in a thread (via ``asyncio.run_in_executor``) so
    it does not block the FastAPI event loop.

    Returns a token_data dict suitable for ``_upsert_token``.
    """
    parsed = urlparse(flow.redirect_uri)
    port = parsed.port

    wsgi_app = _RedirectWSGIApp(
        "Authentication complete. You may close this tab and return to Nexus."
    )
    server = simple_server.make_server(
        "localhost", port, wsgi_app, handler_class=_WSGIRequestHandler
    )

    logger.info("Google OAuth: local server listening on port %d", port)
    try:
        server.handle_request()  # blocks until exactly one redirect arrives
    finally:
        server.server_close()

    # _RedirectWSGIApp stores the last request URI; fetch_token needs https
    redirect_response = wsgi_app.last_request_uri.replace("http", "https")
    flow.fetch_token(authorization_response=redirect_response)
    creds = flow.credentials

    logger.info("Google OAuth: token exchange complete")
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "id_token": getattr(creds, "id_token", None),
        "expiry": creds.expiry,         # naive UTC datetime from google-auth
        "scopes": list(creds.scopes or []),
    }


# ---------------------------------------------------------------------------
# Helpers for creating service
# ---------------------------------------------------------------------------
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


def _load_client_secrets() -> dict:
    """
    Load the credentials.json and return the client config dict.

    Supports both Desktop app ("installed" key) and Web app ("web" key)
    credential files so the code works whether you are using a Desktop
    or Web OAuth client ID.
    """
    import json
    with open(CLIENT_SECRETS_FILE) as f:
        data = json.load(f)
    # Desktop / installed-app client IDs use "installed"; web apps use "web".
    return data.get("installed") or data.get("web") or {}


def _get_client_id() -> str:
    return _load_client_secrets()["client_id"]


def _get_client_secret() -> str:
    return _load_client_secrets()["client_secret"]


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
