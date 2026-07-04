from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User

from app.agent.tools.integrations.google.calendar import get_calendar_service

from app.services.google.google_calendar_service import fetch_events

router = APIRouter(prefix="/google/calendar", tags=["google/calendar"])


@router.get("/events")
def get_events(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    service = get_calendar_service(db, user.id)
    return fetch_events(service)
