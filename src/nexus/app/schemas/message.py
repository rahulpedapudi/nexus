from datetime import datetime
from enum import Enum

from pydantic import UUID4, BaseModel


class RoleEnum(str, Enum):
    user = "user"
    assistant = "assistant"


class SourceEnum(str, Enum):
    web = "web"
    telegram = "telegram"
    discord = "discord"
    tui = "tui"

class MessageBase(BaseModel):
    content: str
    role: RoleEnum
    source: SourceEnum


class MessageCreate(BaseModel):
    content: str
    source: SourceEnum
    telegram_user_id: str | None = None
    discord_user_id: str | None = None
    conv_id: str | None = None



class MessageResponse(MessageBase):
    id: UUID4
    conv_id: UUID4
    user_id: UUID4
    telegram_user_id: str | None = None     
    created_at: datetime
