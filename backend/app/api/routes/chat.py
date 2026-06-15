from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.schemas.message import MessageCreate, MessageResponse
from app.db.database import get_db
from app.services import chat_service
from app.models.user import User
from app.core.dependencies import get_current_user

router = APIRouter()


@router.post("/chat", response_model=MessageResponse)
def chat(
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Blocking chat endpoint — used by the Telegram bot internals."""
    return chat_service.chat(data, db, current_user)


@router.post("/chat/stream")
async def chat_stream(
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE streaming chat endpoint for the web client.

    Returns a text/event-stream where each line is:
        data: <json>\\n\\n

    See chat_service.chat_stream for the event schema.
    """
    return StreamingResponse(
        chat_service.chat_stream(data, db, current_user),
        media_type="text/event-stream",
        headers={
            # Prevent proxies/nginx from buffering the stream
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
