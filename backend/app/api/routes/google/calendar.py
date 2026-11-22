from app.agent.tools.integrations.google.calendar import get_calendar_service
from app.db.database import get_db
from app.services.google.google_calendar_service import fetch_events
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter(prefix="/google/calendar", tags=["google/calendar"])


@router.get("/events")
def get_events(db: Session = Depends(get_db)):
    service = get_calendar_service(db)
    return fetch_events(service)
