from pydantic import BaseModel, UUID4
from datetime import datetime
from pydantic import ConfigDict
from typing import Optional

class TaskBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    note: str | None = None
    status: str
    remind_at: datetime | None = None
    recurring: str | None = None
    priority: str
    tag: str | None = None
    due_date: datetime | None = None
    done: bool
    source: str

class TaskCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    note: str | None = None
    remind_at: datetime | None = None
    recurring: str | None = None
    priority: str
    tag: str | None = None
    due_date: datetime | None = None
    source: str = "on-demand"


class TaskUpdate(BaseModel):
    """Schema for partial task updates — all fields are optional."""
    model_config = ConfigDict(from_attributes=True)

    title: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None
    remind_at: Optional[datetime] = None
    recurring: Optional[str] = None
    priority: Optional[str] = None
    tag: Optional[str] = None
    due_date: Optional[datetime] = None
    done: Optional[bool] = None
    source: Optional[str] = None

class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID4
    created_at: datetime
    updated_at: datetime | None = None
