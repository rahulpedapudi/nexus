import os

from app.models.keys import Keys
from app.schemas.keys import KeyCreate
from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

FERNET_KEY = os.getenv("FERNET_KEY")

fernet = Fernet(FERNET_KEY)


def create_key(data: KeyCreate, db: Session):
    encrypted_key = fernet.encrypt(data.key.encode()).decode()
    # Upsert: update existing key for this provider if one already exists
    existing = db.query(Keys).filter(Keys.provider == data.provider).first()
    if existing:
        existing.encrypted_key = encrypted_key
        db.commit()
        db.refresh(existing)
        return existing
    key = Keys(provider=data.provider, encrypted_key=encrypted_key)
    db.add(key)
    db.commit()
    db.refresh(key)
    return key


def list_keys(db: Session):
    """Return a list of provider names the user has configured."""
    keys = db.query(Keys).all()
    if keys:
        return [k.provider for k in keys]
    else:
        return []


def get_key(db: Session, provider: str):
    key = db.query(Keys).filter(Keys.provider == provider).first()

    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="API key not found"
        )

    return fernet.decrypt(key.encrypted_key.encode()).decode()
