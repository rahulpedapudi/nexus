from pydantic import BaseModel, Field, UUID4
from enum import Enum
from datetime import datetime


class RoleEnum(str, Enum):
    user = "user"
    assistant = "assistant"


class SourceEnum(str, Enum):
    web = "web"
    telegram = "telegram"

class MessageBase(BaseModel):
    content: str
    role: RoleEnum
    source: SourceEnum


class MessageCreate(BaseModel):
    content: str
    source: SourceEnum
    telegram_user_id: str | None = None
    conv_id: str | None = None



class MessageResponse(MessageBase):
    id: UUID4
    conv_id: UUID4
    user_id: UUID4
    telegram_user_id: str | None = None     
    created_at: datetime
