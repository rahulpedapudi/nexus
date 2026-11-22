from app.db.database import get_db
from app.services.todoist.todoist_service import create_task, fetch_tasks
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/todoist", tags=["todoist"])


@router.get("/tasks")
def get_tasks(
    db: Session = Depends(get_db),
    filter_string: str = Query(default=None, description="Filter string for tasks"),
):
    return fetch_tasks(db, filter_string)


@router.post("/tasks")
def post_task(
    db: Session = Depends(get_db),
    text: str = Query(..., description="Task content"),
    note: str = Query(None, description="Task note"),
    reminder: str = Query(None, description="Task reminder"),
):
    return create_task(db, text, note, reminder)
