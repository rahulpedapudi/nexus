import os
import uuid
import hashlib
import secrets
import base64
import logging
from datetime import datetime, UTC

from fastapi import HTTPException, status

from sqlalchemy.orm import Session
from itsdangerous import URLSafeSerializer, BadSignature

from google_auth_oauthlib.flow import Flow

from app.models.user import User
from app.models.oauth_tokens import OAuthToken


logger = logging.getLogger(__name__)

# Allow HTTP for local development (remove in production)
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"


CLIENT_SECRETS_FILE = os.path.join(
    os.path.dirname
    (__file__), "..", "..", "..", "..", "..", "..", "credentials.json"
)

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]
REDIRECT_URI = "http://localhost:8000/integrations/google/callback"

# Secret used to sign the `state` parameter.  In production this should come
# from an env var (e.g. SECRET_KEY).
_STATE_SECRET = os.getenv("SECRET_KEY", "nexus-dev-secret")
_signer = URLSafeSerializer(_STATE_SECRET, salt="google-oauth-state")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_flow() -> Flow:
    return Flow.from_client_secrets_file(
        client_secrets_file=CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )


def _make_code_verifier() -> str:
    """Generate a cryptographically random PKCE code verifier (RFC 7636)."""
    return secrets.token_urlsafe(96)


def _make_code_challenge(verifier: str) -> str:
    """Derive the S256 code challenge from the verifier."""
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


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


def connect_google(
    db: Session, user: User
):
    """
    Return the Google consent screen URL for the authenticated user.
    The user ID and PKCE code_verifier are both signed into `state` so
    the stateless callback can reconstruct the full token exchange.
    """
    flow = _make_flow()

    # PKCE: generate verifier here, store it in state so the callback can use it.
    # The code_challenge is sent to Google; the verifier stays with us.
    code_verifier = _make_code_verifier()
    code_challenge = _make_code_challenge(code_verifier)

    # Pack both user ID and PKCE verifier into the signed state
    state = _signer.dumps({"uid": str(user.id), "cv": code_verifier})

    authorization_url, _ = flow.authorization_url(
        state=state,
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # force refresh_token to be returned every time
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )

    logger.info("Providing Google OAuth consent URL for user %s",
                user.id)
    return {"url": authorization_url}


def google_callback(
    code: str,
    state: str,
    db: Session,
):
    """
    Google redirects here after user grants consent.
    Exchanges the authorization code for tokens and stores them in the DB.
    """
    # 1. Verify & decode the signed state → user ID + PKCE verifier
    try:
        payload = _signer.loads(state)
        user_id_str: str = payload["uid"]
        code_verifier: str = payload["cv"]
    except (BadSignature, KeyError, TypeError):
        logger.warning(
            "Google OAuth callback received invalid or malformed state")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state. Please try connecting again.",
        )

    # 2. Exchange code for tokens, supplying the PKCE verifier to satisfy Google
    flow = _make_flow()
    flow.fetch_token(code=code, code_verifier=code_verifier)
    creds = flow.credentials

    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "id_token": getattr(creds, "id_token", None),
        "expiry": creds.expiry,  # naive UTC datetime from google-auth
        "scopes": list(creds.scopes or []),
    }

    # 3. Upsert in DB
    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Malformed state payload.")

    _upsert_token(db, user_uuid, token_data)
    logger.info("Google Calendar connected for user_id=%s", user_uuid)
