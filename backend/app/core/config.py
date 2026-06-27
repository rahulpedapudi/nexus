from app.core.credentials import CredentialStore
from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv


load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")

creds = CredentialStore()


class Settings(BaseSettings):
    # app settings
    APP_NAME: str = "Nexus"
    VERSION: str = "0.1.0"
    SITE_URL: str = ""

    # llm settings
    LLM_PROVIDER: str = creds.get("LLM_PROVIDER") or "groq"
    GROQ_API_KEY: str = creds.get("GROQ_API_KEY") or ""
    OPENROUTER_API_KEY: str = creds.get("OPENROUTER_API_KEY") or ""

    GROQ_DEFAULT_MODEL: str = creds.get(
        "GROQ_DEFAULT_MODEL") or "openai/gpt-oss-120b"
    OPENROUTER_DEFAULT_MODEL: str = creds.get(
        "OPENROUTER_DEFAULT_MODEL") or "openrouter/free"
    GOOGLE_API_KEY: str = creds.get("GOOGLE_API_KEY") or ""
    EMBEDDING_MODEL: str = creds.get("EMBEDDING_MODEL") or "gemini-embedding-2"

    TELEGRAM_TOKEN: str = creds.get("TELEGRAM_TOKEN") or ""
    DISCORD_TOKEN: str = creds.get("DISCORD_TOKEN") or ""

    # auth settings
    SECRET_KEY: str = JWT_SECRET

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"


settings = Settings()
