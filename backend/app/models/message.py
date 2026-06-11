from app.db.database import Base
from sqlalchemy import ForeignKey, Column, Enum, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
import uuid
import enum


class MessageRole(str, enum.Enum):
    USER = "user",
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(Base):

    __tablename__ = "messages"

    __table_args__ = (
        # Index("idx_messages_conv_id", "conv_id"),
        Index("idx_messages_user_id", "user_id"),
    )
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # conv_id = Column(
    #     UUID(as_uuid=True),
    #     ForeignKey("conversations.id", ondelete="CASCADE")
    # )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE")
    )

    role = Column(
        Enum(MessageRole),
        nullable=False
    )

    content = Column(Text)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC)
    )

    # conversation = relationship(
    #     "Conversation",
    #     back_populates="messages"
    # )
