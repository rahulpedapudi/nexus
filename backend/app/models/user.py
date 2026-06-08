from app.db.database import Base
from sqlalchemy import Column, DateTime, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, UTC
import uuid


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    email = Column(
        String,
        nullable=False,
        unique=True
    )

    username = Column(
        String,
        nullable=False,
        unique=True
    )

    hashed_pass = Column(
        String,
        nullable=False
    )

    last_login = Column(
        DateTime(timezone=True)
    )

    is_active = Column(
        Boolean,
        default=True
    )

    is_setup_complete = Column(
        Boolean,
        default=False
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC)
    )
