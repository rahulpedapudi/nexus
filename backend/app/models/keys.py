from app.db.database import Base
from sqlalchemy import Column, Integer, String, ForeignKey, UUID
import uuid

class Keys(Base):
    __tablename__= "keys"

    id = Column(
        UUID(as_uuid=True),
        default=uuid.uuid4,
        primary_key=True
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL") 
    )

    provider = Column(
        String,
        nullable=False
    )

    encrypted_key = Column(
        String,
        nullable=False
    )
    
    