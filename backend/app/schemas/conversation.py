from datetime import datetime
from enum import Enum

from pydantic import UUID4, BaseModel


class SourceEnum(str, Enum):
    web = "web"
    telegram = "telegram"
    discord = "discord"
    tui = "tui"


class ConversationBase(BaseModel):
    source: SourceEnum


class ConversationResponse(BaseModel):
    id: UUID4
    title: str | None = None
    created_at: datetime
    user_id: UUID4
    source: SourceEnum
