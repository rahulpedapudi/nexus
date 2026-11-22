from app.agent.tools.integrations.google.gmail import get_gmail_service
from app.db.database import get_db
from app.services.google.gmail_service import get_email_by_id as fetch_email_by_id
from app.services.google.gmail_service import (
    list_email_metadata as fetch_email_metadata,
)
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/google/gmail", tags=["Gmail"])


@router.get("/")
def get_email_by_id(db: Session = Depends(get_db), id: str | None = Query(None)):
    service = get_gmail_service(db)
    return fetch_email_by_id(service, id)


@router.get("/metadata")
def list_email_metadata(
    db: Session = Depends(get_db),
    query: str = Query(default="is:unread"),
    max_results: int = Query(default=10),
):
    service = get_gmail_service(db)
    return fetch_email_metadata(service, query, max_results)
