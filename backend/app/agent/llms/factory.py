from sqlalchemy.engine import create
from .base import BaseLLMProvider
from .groq_provider import GroqProvider
from .openrouter_provider import OpenRouterProvider

from app.core.config import settings
from app.core.credentials import creds_store


def build_llm_provider() -> BaseLLMProvider:
    """
    Reads LLM_PROVIDER from settings and returns the appropriate provider.
    Call once at startup and inject the instance wherever needed.
    """
    creds = creds_store.load_credentials()
    provider = creds.get("LLM_PROVIDER").lower()

    if provider == "groq":
        return GroqProvider(
            api_key=creds.get("GROQ_API_KEY"),
            default_model=settings.GROQ_DEFAULT_MODEL,
        )
    elif provider == "openrouter":
        return OpenRouterProvider(
            api_key=creds.get("OPENROUTER_API_KEY"),
            default_model=settings.OPENROUTER_DEFAULT_MODEL,
            site_url=getattr(settings, "SITE_URL", ""),
            app_name=getattr(settings, "APP_NAME", "Nexus"),
        )
    else:
        raise ValueError(
            f"Unknown LLM_PROVIDER='{provider}'. Valid options: groq, openrouter"
        )
