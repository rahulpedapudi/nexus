from datetime import datetime

from pydantic import UUID4, BaseModel, ConfigDict


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

    title: str | None = None
    note: str | None = None
    status: str | None = None
    remind_at: datetime | None = None
    recurring: str | None = None
    priority: str | None = None
    tag: str | None = None
    due_date: datetime | None = None
    done: bool | None = None
    source: str | None = None

class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID4
    created_at: datetime
    updated_at: datetime | None = None
