from app.db.database import get_db
from app.schemas.keys import KeyCreate
from app.services import keys_service
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter()


@router.post("/create")
def create_key(
    data: KeyCreate,
    db: Session = Depends(get_db),
):
    return keys_service.create_key(data, db)


@router.get("/list")
def list_keys(db: Session = Depends(get_db)):
    return keys_service.list_keys(db)


@router.get("/get/{provider}")
def get_key(provider: str, db: Session = Depends(get_db)):
    return keys_service.get_key(db, provider)
