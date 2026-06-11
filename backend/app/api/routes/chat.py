from fastapi import APIRouter, Depends
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
    current_user: User = Depends(get_current_user)          
):
    return chat_service.chat(data, db, current_user)
