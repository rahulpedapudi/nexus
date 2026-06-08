from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.services import auth_service
from app.schemas.auth import LoginRequest, TokenResponse, SetupRequest
from app.schemas.user import UserResponse
from app.db.database import get_db

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


@router.post("/refresh")
def refresh():
    pass
