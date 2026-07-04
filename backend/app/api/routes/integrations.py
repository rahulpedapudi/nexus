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
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.models.user import User
from app.db.database import get_db
from app.agent.tools.integrations.google import auth


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations")

# Thread pool for the blocking wait_for_code() call
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="google-oauth")


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
    Phase 2 (blocking in thread): wait for the redirect, exchange the code,
                                  persist tokens → stream completion event.
    """
    loop = asyncio.get_event_loop()

    async def event_stream():
        # ── Phase 1: build the auth URL (no blocking I/O) ──────────────────
        try:
            auth_url, flow = auth.build_auth_url()
        except Exception as exc:
            logger.exception("Google OAuth: failed to build auth URL")
            yield _sse({"type": "error", "detail": str(exc)})
            return

        yield _sse({"type": "url", "auth_url": auth_url})

        # ── Phase 2: wait for redirect + token exchange (blocking I/O) ─────
        try:
            token_data = await loop.run_in_executor(
                _executor, auth.wait_for_code, flow
            )
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
