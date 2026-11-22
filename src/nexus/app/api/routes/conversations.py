from app.db.database import get_db
from app.schemas.conversation import ConversationResponse
from app.schemas.message import MessageResponse
from app.services import conversation_service
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter()


class RenameRequest(BaseModel):
    title: str


class CreateConversationRequest(BaseModel):
    source: str | None = None


@router.get("/", response_model=list[ConversationResponse])
def get_all_conversations(
    db: Session = Depends(get_db),
):
    return conversation_service.get_all_conversations(db)


@router.post("/", response_model=ConversationResponse)
def create_conversation(
    body: CreateConversationRequest,
    db: Session = Depends(get_db),
):
    return conversation_service.create_conversation(db, body.source)


@router.get("/{conv_id}/messages", response_model=list[MessageResponse])
def get_messages(
    conv_id: str,
    db: Session = Depends(get_db),
):
    return conversation_service.get_messages(conv_id, db)


@router.patch("/{conv_id}", response_model=ConversationResponse)
def rename_conversation(
    conv_id: str,
    body: RenameRequest,
    db: Session = Depends(get_db),
):
    updated = conversation_service.rename_conversation(conv_id, body.title, db)
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return updated


@router.delete("/{conv_id}", status_code=204)
def delete_conversation(
    conv_id: str,
    db: Session = Depends(get_db),
):
    success = conversation_service.delete_conversation(conv_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
