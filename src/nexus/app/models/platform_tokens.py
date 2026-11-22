import uuid
from datetime import UTC, datetime

from app.db.database import Base
from sqlalchemy import UUID, Column, DateTime, ForeignKey, String


class PlatformToken(Base):
    __tablename__ = "platformtokens"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    platform = Column(String, nullable=False)

    token = Column(String, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )
