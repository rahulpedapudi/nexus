from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime, UTC
from sqlalchemy import select, func

from app.schemas.auth import LoginRequest, TokenResponse, SetupRequest
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token


def is_setup_complete(db: Session) -> bool:
    result = db.scalar(select(func.count()).select_from(User))
    return True if result > 0 else False


def setup_user(data: SetupRequest, db: Session):
    if is_setup_complete(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nexus is already setup"
        )

    user = User(
        email=data.email,
        username=data.username,
        hashed_pass=hash_password(data.password),
        is_setup_complete=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def login(data: LoginRequest, db: Session):
    user = db.query(User).filter(
        User.username == data.username
    ).one()

    if not user or not verify_password(data.password, user.hashed_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is Disabled"
        )

    user.last_login = datetime.now(UTC)

    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id)
    )


def refresh_tokens(refresh_token: str, db: Session):
    payload = decode_token(refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload["sub"]

    user = db.query(User).filter(
        User.id == user_id
    ).one()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )
