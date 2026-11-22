from app.db.database import get_db
from app.schemas.memory import MemoryResponse
from app.services import memory_service
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/all", response_model=list[MemoryResponse])
def list_all_memories(db: Session = Depends(get_db)):
    return memory_service.list_all_memories(db)


@router.post("/create", response_model=MemoryResponse)
def add_memory(
    content: str,
    category: str,
    source: str,
    db: Session = Depends(get_db),
):
    return memory_service.store_memory(content, category, source, db)


@router.put("/{memory_id}")
def update_memory(
    memory_id: str,
    new_content: str,
    db: Session = Depends(get_db),
):
    return memory_service.update_memory(memory_id, new_content, db)


@router.delete("/wipe")
async def wipe_memories(
    db: Session = Depends(get_db),
):
    await memory_service.wipe_memories(db)
    return Response(status_code=204)


@router.delete("/{memory_id}")
def delete_memory(
    memory_id: str,
    db: Session = Depends(get_db),
):
    return memory_service.delete_memory(memory_id, db)
