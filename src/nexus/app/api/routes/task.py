from datetime import datetime

from app.db.database import get_db
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services import task_service
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/all", response_model=list[TaskResponse])
def get_all_tasks(db: Session = Depends(get_db)):
    """
    Get all tasks for the current user
    """
    return task_service.get_tasks(db)


@router.get("/search", response_model=list[TaskResponse])
def search_tasks(
    db: Session = Depends(get_db),
    query: str | None = Query(None, description="Substring match on title or note"),
    status: str | None = Query(
        None, description="Filter by status (e.g. pending, done)"
    ),
    priority: str | None = Query(
        None, description="Filter by priority (e.g. high, medium, low)"
    ),
    tag: str | None = Query(None, description="Filter by tag (exact match)"),
    done: bool | None = Query(None, description="Filter by completion state"),
    due_before: datetime | None = Query(
        None, description="Tasks due on or before this datetime (ISO 8601)"
    ),
    due_after: datetime | None = Query(
        None, description="Tasks due on or after this datetime (ISO 8601)"
    ),
    remind_before: datetime | None = Query(
        None, description="Tasks with remind_at on or before this datetime (ISO 8601)"
    ),
    remind_after: datetime | None = Query(
        None, description="Tasks with remind_at on or after this datetime (ISO 8601)"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
):
    """
    Advanced task search with optional filters.
    All parameters are combinable; omit any you don't need.
    """
    return task_service.search_tasks(
        db=db,
        query=query,
        status=status,
        priority=priority,
        tag=tag,
        done=done,
        due_before=due_before,
        due_after=due_after,
        remind_before=remind_before,
        remind_after=remind_after,
        limit=limit,
    )


@router.post("/create", response_model=TaskResponse)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new task for the current user
    """
    return task_service.create_task(db, task)


@router.patch("/update/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    task: TaskUpdate,
    db: Session = Depends(get_db),
):
    """
    Partially update a task for the current user.
    Only the provided fields will be updated.
    """
    return task_service.update_task(db, task_id, task)


@router.delete("/delete/{task_id}", response_model=TaskResponse)
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
):
    """
    Delete a task for the current user
    """
    return task_service.delete_task(db, task_id)
