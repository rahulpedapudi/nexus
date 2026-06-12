from app.schemas.message import MessageResponse
from app.schemas.conversation import ConversationResponse
from fastapi import Depends
from fastapi import APIRouter
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.core.dependencies import get_current_user
from app.services import conversation_service

router = APIRouter()

@router.get("/", response_model=list[ConversationResponse])
def get_all_conversations(
    db:Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
    ):
    return conversation_service.get_all_conversations(db, current_user)


@router.post("/", response_model=ConversationResponse)
def create_conversation(
    db:Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)):
    return conversation_service.create_conversation(db, current_user)

# 44777ea8-4606-4052-9e2b-d77615aaddfd\


@router.get("/{conv_id}", response_model=list[MessageResponse])
def get_messages(
    conv_id: str,
    db:Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)):
    return conversation_service.get_messages(conv_id, db, current_user)


@router.delete("/{conv_id}")
def delete_conv(
    conv_id: str,
    db:Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)):
    pass

