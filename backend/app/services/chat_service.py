import os
from groq import Groq
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.models.message import Message
from app.schemas.message import MessageCreate, MessageResponse
from app.services.llm_service import stream_llm_response
from app.models.user import User

load_dotenv()

client = Groq(
    api_key=os.getenv("GRQO_API_KEY")
)


def chat(data: MessageCreate, db: Session, current_user: User ):
    user_message = Message(
        content=data.content,
        role="user",
        user_id=current_user.id
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    recent_messages = db.query(Message).order_by(
        Message.created_at.asc()
    ).limit(15).all()

    formatted_msgs = [
        {"role": msg.role, "content": msg.content}
        for msg in recent_messages
    ]

    llm_response = stream_llm_response(formatted_msgs)

    llm_message = Message(
        content=llm_response,
        role="assistant",
        user_id=current_user.id
    )

    db.add(llm_message)
    db.commit()
    db.refresh(llm_message)

    return llm_message
