from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv


load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")


class Settings(BaseSettings):
    # app settings
    APP_NAME: str = "Nexus"
    VERSION: str = "0.1.0"
    SITE_URL: str = ""

    # llm settings
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER") or "groq"
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY") or ""
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY") or ""

    GROQ_DEFAULT_MODEL: str = os.getenv("GROQ_DEFAULT_MODEL") or ""
    OPENROUTER_DEFAULT_MODEL: str = os.getenv("OPENROUTER_DEFAULT_MODEL") or ""
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL") or ""

    # auth settings
    SECRET_KEY: str = JWT_SECRET

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"


settings = Settings()
