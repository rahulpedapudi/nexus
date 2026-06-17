from uuid import UUID
from app.models.user import User
from app.models.tasks import Task
from sqlalchemy.orm import Session
from app.schemas.task import TaskCreate, TaskUpdate
from fastapi import HTTPException

def get_tasks(db: Session, user: User) -> list[Task]:
    return db.query(Task).filter(Task.user_id == user.id).all()

def search_tasks(db: Session, user: User, query: str) -> list[Task]:
    """Case-insensitive substring search on task title. Returns up to 5 matches."""
    return (
        db.query(Task)
        .filter(Task.user_id == user.id, Task.title.ilike(f"%{query}%"))
        .limit(5)
        .all()
    )

def create_task(db: Session, user: User, task_data: TaskCreate) -> Task:
    task = Task(**task_data.model_dump(), user_id=user.id)    
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

def update_task(db: Session, user: User, task_id: str, task_data: TaskUpdate) -> Task:
    task = db.query(Task).filter(
        Task.user_id == user.id,
        Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Only update fields that were explicitly provided in the request
    for key, value in task_data.model_dump(exclude_unset=True).items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task

def delete_task(db: Session, user: User, task_id: str) -> Task:
    task = db.query(Task).filter(
        Task.user_id == user.id,
        Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return task