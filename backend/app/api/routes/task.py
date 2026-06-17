from app.services import task_service
from app.models.tasks import Task
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.models.user import User
from app.core.dependencies import get_current_user

from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter()

@router.get("/all", response_model=list[TaskResponse])
def get_all_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all tasks for the current user
    """
    return task_service.get_tasks(db, current_user)


@router.get("/search", response_model=list[TaskResponse])
def search_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    query: Optional[str] = Query(None, description="Substring match on title or note"),
    status: Optional[str] = Query(None, description="Filter by status (e.g. pending, done)"),
    priority: Optional[str] = Query(None, description="Filter by priority (e.g. high, medium, low)"),
    tag: Optional[str] = Query(None, description="Filter by tag (exact match)"),
    done: Optional[bool] = Query(None, description="Filter by completion state"),
    due_before: Optional[datetime] = Query(None, description="Tasks due on or before this datetime (ISO 8601)"),
    due_after: Optional[datetime] = Query(None, description="Tasks due on or after this datetime (ISO 8601)"),
    remind_before: Optional[datetime] = Query(None, description="Tasks with remind_at on or before this datetime (ISO 8601)"),
    remind_after: Optional[datetime] = Query(None, description="Tasks with remind_at on or after this datetime (ISO 8601)"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
):
    """
    Advanced task search with optional filters.
    All parameters are combinable; omit any you don't need.
    """
    return task_service.search_tasks(
        db=db,
        user=current_user,
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
    current_user: User = Depends(get_current_user)
):
    """
    Create a new task for the current user
    """
    return task_service.create_task(db, current_user, task)


@router.patch("/update/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    task: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Partially update a task for the current user.
    Only the provided fields will be updated.
    """
    return task_service.update_task(db, current_user, task_id, task)


@router.delete("/delete/{task_id}", response_model=TaskResponse)
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a task for the current user
    """
    return task_service.delete_task(db, current_user, task_id)