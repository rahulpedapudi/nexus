from app.models import user
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.memory import Memory
from app.services import embedding_service  

def list_all_memories(db: Session, user: User):
    return db.query(Memory).filter(
        Memory.user_id == user.id
    ).order_by(Memory.created_at.desc()).all()
    

def memory_exists(db: Session, user: User, embedding_values: list, threshold: float = 0.92) -> bool:
    ''' 
        Checks if a memory already exists in the database using cosine similarity.
        It considers the memory as existing if the cosine similarity between the new memory 
        embedding and the existing memory embedding is greater than the threshold.
        
        Args:
            db (Session): The database session.
            user (User): The user for whom the memory is to be checked.
            embedding_values (list): The embedding values of the memory to be checked.
            threshold (float): The threshold for cosine similarity. Defaults to 0.92.
        
        Returns:
            bool: True if the memory exists, False otherwise.
    '''
    embedding_str = f"[{','.join(str(x) for x in embedding_values)}]"
    
    result = db.execute(text(f"""
        SELECT 1 FROM memories
        WHERE user_id = :user_id
        AND 1 - (embedding <=> '{embedding_str}'::vector) > :threshold
        LIMIT 1
    """), {"user_id": str(user.id), "threshold": threshold}).fetchone()
    
    return result is not None           


def store_memory(content: str, category: str, source: str, db: Session, user: User):
    # TODO:  i need better way of validating the category input, cause user might enter it in various forms.

    embedding = embedding_service.generate_embedding(content, task_type="RETRIEVAL_DOCUMENT")
    if memory_exists(db, user, embedding):
        return None
    
    memory = Memory(
        user_id=user.id,
        content=content,
        embedding=embedding,
        category=category,
        source=source
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory

    
def search_memories(db: Session, user: User, query: str, limit: int = 5):
    query_embedding = embedding_service.generate_embedding(query, task_type="RETRIEVAL_QUERY")
    
    embedding_str = f"[{','.join(str(x) for x in query_embedding)}]"

    results = db.execute(text("""
        SELECT id, content, category, created_at,
            1 - (embedding <=> :embedding::vector) AS similarity
        FROM memories
        WHERE user_id = :user_id
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """.replace(":embedding", f"'{embedding_str}'")), {
        "user_id": str(user.id),
        "limit": limit
    }).fetchall()
    
    return results


def update_memory(memory_id, new_content, db: Session, user: User):
    memory = db.query(Memory).filter(
        Memory.id == memory_id,
        Memory.user_id == user.id
    ).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    # if user updates the content like "my name is xyz" to "my name is abc", the content should be stored as the llm understands it, like "name of user is abc" not "my name is abc".
    # but this adds some delay in updating the memory so i'm not going to do it for now.    
    memory.content = new_content


    memory.embedding = embedding_service.generate_embedding(new_content, task_type="RETRIEVAL_DOCUMENT")
    db.commit()
    return memory


def delete_memory(memory_id, db: Session, user: User):
    memory = db.query(Memory).filter(
        Memory.id == memory_id,
        Memory.user_id == user.id
    ).first()
    
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    db.delete(memory)
    db.commit()
    return {"message": "Memory deleted successfully"}


async def wipe_memories(db: Session, user: User):
    db.query(Memory).filter(Memory.user_id == user.id).delete()
    db.commit()