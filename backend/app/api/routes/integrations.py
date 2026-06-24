"""
Google OAuth2 integration routes.

Flow:
    1.  GET /integrations/google/connect
        → Authenticated user hits this; backend redirects to Google consent screen.
          The user's ID is signed into the `state` parameter so the callback
          can identify them without a session.

    2.  GET /integrations/google/callback?code=...&state=...
        → Google redirects here after consent.
          Backend verifies the `state`, exchanges `code` for tokens, and
          upserts an OAuthToken row for the user.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session


from app.core.dependencies import get_current_user
from app.models.user import User
from app.db.database import get_db

from app.agent.tools.integrations.google import auth


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations")


# Routes

@router.get("/google/connect")
def connect_google(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the Google consent screen URL for the authenticated user.
    The user ID and PKCE code_verifier are both signed into `state` so
    the stateless callback can reconstruct the full token exchange.
    """
    return auth.connect_google(db, current_user)


@router.get("/google/callback")
def google_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    try:
        auth.google_callback(code, state, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    return JSONResponse(
        status_code=200,
        content={"status": "connected", "provider": "google"},
    )
