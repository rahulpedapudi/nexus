from app.services import keys_service
from app.models import keys
from fastapi import Depends, Security, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.core.security import decode_token

import uuid


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    bearer: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    user: User | None = None

    if bearer and bearer.credentials:
        payload = decode_token(bearer.credentials)
        if payload and payload.get("type") == "access":
            user_id = uuid.UUID(payload["sub"])
            user = db.query(User).filter(
                User.id == user_id
            ).one_or_none()
            

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def get_api_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> str:
    return keys_service.get_key(db, current_user)