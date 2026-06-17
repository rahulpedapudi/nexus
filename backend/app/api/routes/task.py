from app.services import task_service
from app.models.tasks import Task
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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