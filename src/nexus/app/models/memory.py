import uuid
from datetime import UTC, datetime

from app.db.database import Base
from pgvector.sqlalchemy import Vector
from sqlalchemy import UUID, Column, DateTime, ForeignKey, String, Text


class Memory(Base):
    __tablename__ = "memories"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)

    # user_id = Column(UUID, ForeignKey("users.id"), nullable=False)

    content = Column(Text, nullable=False)  # "User is vegetarian"
    embedding = Column(Vector(768), nullable=False)  # pgvector column
    category = Column(String)  # preference | fact | pattern | habit
    source = Column(String)  # "auto" | "manual"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(UTC))
