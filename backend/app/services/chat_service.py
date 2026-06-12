import os
from groq import Groq
from sqlalchemy.orm import Session
from fastapi import HTTPException
from dotenv import load_dotenv

from app.models.message import Message
from app.models.conversation import Conversation
from app.schemas.message import MessageCreate
from app.services.llm_service import stream_llm_response
from app.models.user import User

from app.services.conversation_service import get_or_create_telegram_conversation

load_dotenv()

client = Groq(
    api_key=os.getenv("GRQO_API_KEY")
)


def chat(data: MessageCreate, db: Session, current_user: User ):

    # single convo for telegram per user
    if data.source == "telegram":
        conversation = get_or_create_telegram_conversation(current_user.id, db)
    else:
        # if source is not telegram, we can have multiple conversations/ sessions like a standard chatbot
        conversation = db.query(Conversation).filter(
            Conversation.id == data.conv_id,
            Conversation.user_id == current_user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")


    user_message = Message(
        content=data.content,
        role="user",
        telegram_user_id=data.telegram_user_id if data.telegram_user_id else None,
        user_id=current_user.id,
        conv_id=conversation.id,
        source=data.source if data.source else "web"
    )

    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # TODO: we need to implement context summarisation if messages are > 20
    
    recent_messages = db.query(Message).filter(
        Message.conv_id == conversation.id,
        Message.user_id == current_user.id
    ).order_by(
        Message.created_at.desc()  # newest first
    ).limit(15).all()

    recent_messages = list(reversed(recent_messages))

    formatted_msgs = [
        {"role": msg.role, "content": msg.content}
        for msg in recent_messages
    ]

    llm_response = stream_llm_response(formatted_msgs)

    llm_message = Message(
        content=llm_response,
        role="assistant",
        user_id=current_user.id,
        telegram_user_id=data.telegram_user_id if data.telegram_user_id else None,
        conv_id=conversation.id,
        source=data.source if data.source else "web"
    )

    db.add(llm_message)
    db.commit()
    db.refresh(llm_message)

    return llm_message
