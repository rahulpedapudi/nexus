from app.schemas.keys import KeyCreate
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.core.dependencies import get_current_user
from app.services import keys_service

router = APIRouter()

@router.post("/create")
def create_key(
    data: KeyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return keys_service.create_key(data, db, user)


@router.get("/list")
def list_keys(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return keys_service.list_keys(db, user)


@router.get("/get/{provider}")
def get_key(
    provider: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return keys_service.get_key(db, user, provider)