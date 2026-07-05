"""
Google OAuth2 integration routes — Desktop / Installed App flow via SSE.

Flow:
    GET /integrations/google/connect   (text/event-stream)

    The endpoint streams two Server-Sent Events:

    1.  data: {"type": "url",  "auth_url": "https://accounts.google.com/..."}
        Emitted immediately — the TUI displays this URL so the user can open
        it in their browser.

    2.  data: {"type": "done", "status": "connected", "provider": "google"}
        Emitted after Google redirects back, the code is exchanged for tokens,
        and the tokens are persisted in the DB.

    On any error:
        data: {"type": "error", "detail": "..."}
"""
import asyncio
import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.models.user import User
from app.db.database import get_db
from app.agent.tools.integrations.google import auth


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations")


def _sse(data: dict) -> str:
    """Format a dict as a Server-Sent Event data line."""
    return f"data: {json.dumps(data)}\n\n"


@router.get("/google/connect")
async def connect_google_sse(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE endpoint that drives the two-phase Google OAuth flow.

    Phase 1 (instant): generate the auth URL → stream it to the client.
    Phase 2 (async wait): await the callback from the ``/google/callback``
                          route, then persist tokens → stream completion.
    """
    async def event_stream():
        # ── Phase 1: build the auth URL ─────────────────────────────────────
        try:
            auth_url, state = auth.build_auth_url()
        except Exception as exc:
            logger.exception("Google OAuth: failed to build auth URL")
            yield _sse({"type": "error", "detail": str(exc)})
            return

        yield _sse({"type": "url", "auth_url": auth_url})

        # ── Phase 2: wait for the callback route to signal completion ─────
        try:
            token_data = await auth.wait_for_callback(state)
        except Exception as exc:
            logger.exception("Google OAuth: token exchange failed")
            yield _sse({"type": "error", "detail": str(exc)})
            return

        # ── Persist tokens ──────────────────────────────────────────────────
        try:
            auth._upsert_token(db, current_user.id, token_data)
        except Exception as exc:
            logger.exception("Google OAuth: failed to persist token")
            yield _sse({"type": "error", "detail": f"Token storage failed: {exc}"})
            return

        logger.info("Google connected for user_id=%s", current_user.id)
        yield _sse({"type": "done", "status": "connected", "provider": "google"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering if present
            "Connection": "keep-alive",
        },
    )


@router.get("/google/callback")
async def google_oauth_callback(request: Request):
    """
    Receives the OAuth redirect from Google after the user grants consent.

    Google sends ``code`` and ``state`` as query parameters. This route
    exchanges the code for tokens (via ``auth.handle_callback``) and
    signals the waiting SSE stream.
    """
    state = request.query_params.get("state", "")
    code = request.query_params.get("code", "")

    if not state or not code:
        return HTMLResponse(
            "<h2>Missing parameters.</h2><p>Please try connecting again from Nexus.</p>",
            status_code=400,
        )

    try:
        auth.handle_callback(state, code)
    except ValueError as exc:
        logger.exception("Google OAuth callback: invalid state")
        return HTMLResponse(
            f"<h2>OAuth error</h2><p>{exc}</p>",
            status_code=400,
        )
    except Exception as exc:
        logger.exception("Google OAuth callback: token exchange failed")
        return HTMLResponse(
            f"<h2>Authentication failed</h2><p>{exc}</p>",
            status_code=500,
        )

    return HTMLResponse(
        "<h2>Authentication complete!</h2>"
        "<p>You may close this tab and return to Nexus.</p>",
    )
