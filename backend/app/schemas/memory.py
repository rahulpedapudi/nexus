from datetime import datetime
from pydantic import BaseModel,UUID4,ConfigDict

class MemoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID4
    user_id: UUID4
    content: str
    # embedding: list[float]
    category: str
    source: str
    created_at: datetime
    updated_at: datetime | None = None