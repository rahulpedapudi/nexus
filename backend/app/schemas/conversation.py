from pydantic import BaseModel, UUID4
from datetime import datetime
from enum import Enum


class SourceEnum(str, Enum):
    web = "web"
    telegram = "telegram"


class ConversationBase(BaseModel):
    source: SourceEnum
    

class ConversationResponse(BaseModel):
    id: UUID4
    title: str
    created_at: datetime
    user_id: UUID4
    source: SourceEnum