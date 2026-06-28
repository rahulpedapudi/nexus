from google import genai
from google.genai import types
from app.core.config import settings



def generate_embedding(text: str, task_type: str = "RETRIEVAL_DOCUMENT" or "RETRIEVAL_QUERY"):
    GEMINI_API_KEY = settings.GOOGLE_API_KEY 

    if GEMINI_API_KEY:
        client = genai.Client(api_key=GEMINI_API_KEY)
    else:
        client = None
    
    result = client.models.embed_content(
        model=settings.EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=768,
        )
    )

    return result.embeddings[0].values
