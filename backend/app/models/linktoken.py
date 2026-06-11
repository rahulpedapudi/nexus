from app.db.database import Base
from sqlalchemy import Column, String, UUID, ForeignKey, DateTime

import uuid


class TelegramLinkToken(Base):
    __tablename__ = "telegramtokens"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    token = Column(
        String,
        nullable=False
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL")
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )
