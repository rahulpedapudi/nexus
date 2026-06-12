from sqlalchemy.orm import Session
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message

def get_or_create_telegram_conversation(user_id, db):
    convo = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.source == "telegram"
    ).first()

    if not convo:
        convo = Conversation(user_id=user_id, source="telegram")
        db.add(convo)
        db.commit()

    return convo


def get_all_conversations(db: Session, user: User):
    return db.query(Conversation).filter(
        Conversation.user_id == user.id
    ).all()


def create_conversation(db: Session, user: User):
    conversation = Conversation(
        user_id=user.id,
        title="Untitled",
        source="web"
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def get_messages(conv_id: str, db: Session, user: User):
    return db.query(Message).filter(
        Message.conv_id == conv_id,
        Message.user_id == user.id
    ).all()