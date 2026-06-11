from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.services import auth_service
from app.schemas.auth import LoginRequest, TokenResponse, SetupRequest
from app.schemas.user import UserResponse
from app.db.database import get_db

from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    return auth_service.login(data, db)


@router.post("/setup", response_model=UserResponse)
def setup(
    data: SetupRequest,
    db: Session = Depends(get_db)
):
    return auth_service.setup_user(data, db)


@router.post("/generate-link-token")
def generate_link_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    token = auth_service.generate_link_token(db, current_user)
    return {"token": token}


@router.post("/link-telegram")
def link_telegram(token: str, telegram_id: str, db: Session = Depends(get_db)):
    return auth_service.link_telegram(token, telegram_id, db)


@router.post("/refresh")
def refresh():
    pass
