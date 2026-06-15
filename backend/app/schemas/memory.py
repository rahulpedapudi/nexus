from datetime import datetime
from pydantic import BaseModel, UUID4

class MemoryResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    content: str
    embedding: list[float]
    category: str
    source: str
    created_at: datetime
    updated_at: datetime