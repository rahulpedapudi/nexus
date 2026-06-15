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
        convo = Conversation(user_id=user_id, source="telegram", title="Telegram Chat")
        db.add(convo)
        db.commit()

    return convo


def get_all_conversations(db: Session, user: User):
    return db.query(Conversation).filter(
        Conversation.user_id == user.id
    ).order_by(Conversation.created_at.desc()).all()


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
    ).order_by(Message.created_at.asc()).all()


def delete_conversation(conv_id: str, db: Session, user: User) -> bool:
    """Hard-delete a conversation owned by user. Returns True on success."""
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == user.id,
    ).first()
    if not conversation:
        return False
    db.delete(conversation)
    db.commit()
    return True


def rename_conversation(conv_id: str, title: str, db: Session, user: User):
    """Rename a conversation title. Returns updated conversation or None."""
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == user.id,
    ).first()
    if not conversation:
        return None
    conversation.title = title
    db.commit()
    db.refresh(conversation)
    return conversation