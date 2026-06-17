from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.user import User
from app.models.tasks import Task
from sqlalchemy.orm import Session
from app.schemas.task import TaskCreate, TaskUpdate
from fastapi import HTTPException

def get_tasks(db: Session, user: User) -> list[Task]:
    return db.query(Task).filter(Task.user_id == user.id).all()

def search_tasks(
    db: Session,
    user: User,
    query: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    tag: Optional[str] = None,
    done: Optional[bool] = None,
    due_before: Optional[datetime] = None,
    due_after: Optional[datetime] = None,
    remind_before: Optional[datetime] = None,
    remind_after: Optional[datetime] = None,
    limit: int = 20,
) -> list[Task]:
    """
    Advanced search/filter for tasks.

    All parameters are optional and combinable:
    - query       : case-insensitive substring match on title *or* note
    - status      : exact match on status (e.g. 'pending', 'done')
    - priority    : exact match on priority (e.g. 'high', 'medium', 'low')
    - tag         : exact match on tag
    - done          : boolean filter on the done column
    - due_before    : tasks whose due_date is <= this datetime
    - due_after     : tasks whose due_date is >= this datetime
    - remind_before : tasks whose remind_at is <= this datetime
    - remind_after  : tasks whose remind_at is >= this datetime
    - limit         : max results returned (default 20, capped at 100)
    """
    limit = min(limit, 100)  # hard cap to prevent abuse

    q = db.query(Task).filter(Task.user_id == user.id)

    if query:
        q = q.filter(
            Task.title.ilike(f"%{query}%") | Task.note.ilike(f"%{query}%")
        )
    if status is not None:
        q = q.filter(Task.status == status)
    if priority is not None:
        q = q.filter(Task.priority == priority)
    if tag is not None:
        q = q.filter(Task.tag == tag)
    if done is not None:
        q = q.filter(Task.done == done)
    if due_after is not None:
        q = q.filter(Task.due_date >= due_after)
    if due_before is not None:
        q = q.filter(Task.due_date <= due_before)
    if remind_after is not None:
        q = q.filter(Task.remind_at >= remind_after)
    if remind_before is not None:
        q = q.filter(Task.remind_at <= remind_before)

    return q.order_by(Task.created_at.desc()).limit(limit).all()

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