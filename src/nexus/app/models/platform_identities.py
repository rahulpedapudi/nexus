import uuid
from datetime import UTC, datetime

from app.db.database import Base
from sqlalchemy import (
    UUID,
    Column,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship


class PlatformIdentity(Base):
    __tablename__ = "platformidentities"

    __table_args__ = (
        UniqueConstraint("platform", "platform_id", name="uq_platform_identity"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))

    platform = Column(String, nullable=False)

    platform_id = Column(String, nullable=False)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # user = relationship("User", back_populates="identities")
