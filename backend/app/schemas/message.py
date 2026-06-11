from pydantic import BaseModel, Field, UUID4
from enum import Enum
from datetime import datetime


class RoleEnum(str, Enum):
    user = "user"
    assistant = "assistant"


class MessageBase(BaseModel):
    content: str
    role: RoleEnum


class MessageCreate(BaseModel):
    content: str


class MessageResponse(MessageBase):
    id: UUID4
    created_at: datetime
