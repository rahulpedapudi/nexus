from app.core.credentials import creds_store
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
    LLM_PROVIDER: str = creds_store.get("LLM_PROVIDER") or ""
    GROQ_API_KEY: str = creds_store.get("GROQ_API_KEY") or ""
    OPENROUTER_API_KEY: str = creds_store.get("OPENROUTER_API_KEY") or ""

    GROQ_DEFAULT_MODEL: str = creds_store.get(
        "GROQ_DEFAULT_MODEL") or "openai/gpt-oss-120b"
    OPENROUTER_DEFAULT_MODEL: str = creds_store.get(
        "OPENROUTER_DEFAULT_MODEL") or "openrouter/free"
    GEMINI_DEFAULT_MODEL: str = creds_store.get(
        "GEMINI_DEFAULT_MODEL") or "gemini-3.1-flash-lite"
    GOOGLE_API_KEY: str = creds_store.get("GOOGLE_API_KEY") or ""
    EMBEDDING_MODEL: str = creds_store.get(
        "EMBEDDING_MODEL") or "gemini-embedding-2"

    ENABLED_GATEWAYS: list[str] = creds_store.get("ENABLED_GATEWAYS") or []

    # TELEGRAM_TOKEN: str = creds_store.get("TELEGRAM_TOKEN") or ""
    # DISCORD_TOKEN: str = creds_store.get("DISCORD_TOKEN") or ""

    # auth settings
    SECRET_KEY: str = JWT_SECRET

    TODOIST_URL: str = "https://api.todoist.com/api/v1"

    TODOIST_TOKEN: str = ""

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"


settings = Settings()
