from app.models.memory import Memory
from app.services import embedding_service
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session


def list_all_memories(db: Session):
    return db.query(Memory).order_by(Memory.created_at.desc()).all()


def memory_exists(db: Session, embedding_values: list, threshold: float = 0.92) -> bool:
    """
    Checks if a memory already exists in the database using cosine similarity.
    It considers the memory as existing if the cosine similarity between the new memory
    embedding and the existing memory embedding is greater than the threshold.

    Args:
        db (Session): The database session.
        embedding_values (list): The embedding values of the memory to be checked.
        threshold (float): The threshold for cosine similarity. Defaults to 0.92.

    Returns:
        bool: True if the memory exists, False otherwise.
    """
    embedding_str = f"[{','.join(str(x) for x in embedding_values)}]"

    result = db.execute(
        text(f"""
        SELECT 1 FROM memories
        AND 1 - (embedding <=> '{embedding_str}'::vector) > :threshold
        LIMIT 1
    """),
        {"threshold": threshold},
    ).fetchone()

    return result is not None


def store_memory(content: str, category: str, source: str, db: Session):
    # TODO:  i need better way of validating the category input, cause user might enter it in various forms.

    embedding = embedding_service.generate_embedding(
        content, task_type="RETRIEVAL_DOCUMENT"
    )
    if memory_exists(db, embedding):
        return None

    memory = Memory(
        content=content,
        embedding=embedding,
        category=category,
        source=source,
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


def search_memories(db: Session, query: str, limit: int = 5):
    query_embedding = embedding_service.generate_embedding(
        query, task_type="RETRIEVAL_QUERY"
    )

    embedding_str = f"[{','.join(str(x) for x in query_embedding)}]"

    results = db.execute(
        text(
            """
        SELECT id, content, category, created_at,
            1 - (embedding <=> :embedding::vector) AS similarity
        FROM memories
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """.replace(":embedding", f"'{embedding_str}'")
        ),
        {"limit": limit},
    ).fetchall()

    return results


def update_memory(memory_id, new_content, db: Session):
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    # if user updates the content like "my name is xyz" to "my name is abc", the content should be stored as the llm understands it, like "name of user is abc" not "my name is abc".
    # but this adds some delay in updating the memory so i'm not going to do it for now.
    memory.content = new_content

    memory.embedding = embedding_service.generate_embedding(
        new_content, task_type="RETRIEVAL_DOCUMENT"
    )
    db.commit()
    return memory


def delete_memory(memory_id, db: Session):
    memory = db.query(Memory).filter(Memory.id == memory_id).first()

    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    db.delete(memory)
    db.commit()
    return {"message": "Memory deleted successfully"}


async def wipe_memories(db: Session):
    """
    DANGER: This function will delete all memories in the database.
    Use with caution.
    """
    db.query(Memory).delete()
    db.commit()
