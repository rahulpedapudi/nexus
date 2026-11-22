import uuid
from datetime import UTC, datetime

from app.db.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # user_id = Column(
    #     UUID(as_uuid=True),
    #     ForeignKey("users.id", ondelete="CASCADE"),
    # )

    title = Column(
        String,
        nullable=True,
    )

    source = Column(String)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    updated_at = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(UTC))

    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )
