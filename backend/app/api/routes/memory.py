from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.user import User
from app.core.dependencies import get_current_user
from app.schemas.memory import MemoryResponse
from app.services import memory_service

router = APIRouter()

@router.get("/all", response_model=list[MemoryResponse])
def list_all_memories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)

):
    return memory_service.list_all_memories(db, user)

@router.post("/create")
def add_memory():
    pass

@router.put("/{memory_id}")
def update_memory():
    pass

@router.delete("/{memory_id}")
def delete_memory():
    pass                            