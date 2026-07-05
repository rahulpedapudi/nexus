from app.core.dependencies import get_current_user
from sqlalchemy.orm import Session
from app.db.database import get_db
from fastapi import Query
from fastapi import Depends
from fastapi import APIRouter
from app.models.user import User
from app.services.todoist.todoist_service import fetch_tasks, create_task

router = APIRouter(prefix="/todoist", tags=["todoist"])


@router.get("/tasks")
def get_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    filter_string: str = Query(
        default=None, description="Filter string for tasks")
):
    return fetch_tasks(db, user, filter_string)


@router.post("/tasks")
def post_task(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    text: str = Query(..., description="Task content"),
    note: str = Query(None, description="Task note"),
    reminder: str = Query(None, description="Task reminder"),
):
    return create_task(db, user, text, note, reminder)
