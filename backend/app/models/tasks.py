from app.db.database import Base

from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, UTC

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )

    user_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"), 
        nullable=False
    )
    
    title = Column(
        String(500), 
        nullable=False
    )

    note = Column(
        String(500), 
        nullable=True
    )

    status = Column(
        String,
        default="pending",
        nullable=False
    )

    remind_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    recurring = Column(
        String,
        nullable=True
    )

    priority = Column(
        String,
        nullable=False
    )

    tag = Column(
        String,
        nullable=True
    )

    due_date = Column(
        DateTime(timezone=True),
        nullable=True
    )

    done = Column(
        Boolean,
        default=False
    )

    reminded = Column(
        Boolean,
        default=False,
        nullable=False
    )

    source = Column(
        String(50), 
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(UTC)
    )
    
    updated_at = Column(
        DateTime(timezone=True), 
        onupdate=lambda: datetime.now(UTC)
    )

    user = relationship("User", lazy="select")