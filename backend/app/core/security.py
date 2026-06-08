import bcrypt
from datetime import datetime, timedelta, UTC
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(plain: str) -> str:
    return (bcrypt.hashpw(plain.encode(), bcrypt.gensalt())).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _create_token(data:  dict[str, any], expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(UTC) + expires_delta

    return jwt.encode(payload, settings.SECRET_KEY, settings.ALGORITHM)


def create_access_token(user_id) -> str:
    return _create_token(
        {"sub": str(user_id), "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )


def create_refresh_token(user_id):
    return _create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )


def decode_token(token: str) -> dict[str, any]:
    try:
        jwt.decode(token, settings.SECRET_KEY,
                   algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
