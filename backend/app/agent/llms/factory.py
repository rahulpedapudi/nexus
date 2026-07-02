import logging
from .base import BaseLLMProvider
from .groq_provider import GroqProvider
from .openrouter_provider import OpenRouterProvider
from .gemini_provider import GeminiProvider

from app.core.config import settings
from app.core.credentials import creds_store

logger = logging.getLogger(__name__)


def build_llm_provider() -> BaseLLMProvider:
    """
    Reads LLM_PROVIDER from settings and returns the appropriate provider.
    Call once at startup and inject the instance wherever needed.
    """
    creds = creds_store.load_credentials()
    provider = None
    try:
        provider = creds.get("LLM_PROVIDER", None)
        if provider is None:
            logger.warning("No LLM_PROVIDER found in credentials")
            return None

    except Exception as e:
        logger.warning("Failed to load LLM_PROVIDER from credentials: %s", e)

    if provider == "groq":
        try:
            api_key = creds_store.get("GROQ_API_KEY")
        except Exception as e:
            logger.warning(
                "Failed to load GROQ_API_KEY from credentials: %s", e)
            return None

        if api_key is None:
            logger.warning("GROQ_API_KEY not found in credentials")
            return None

        return GroqProvider(
            api_key=api_key,
            default_model=settings.GROQ_DEFAULT_MODEL,
        )
    elif provider == "openrouter":
        try:
            api_key = creds_store.get("OPENROUTER_API_KEY")
        except Exception as e:
            logger.warning(
                "Failed to load OPENROUTER_API_KEY from credentials: %s", e)
            return None

        if api_key is None:
            logger.warning("OPENROUTER_API_KEY not found in credentials")
            return None

        return OpenRouterProvider(
            api_key=api_key,
            default_model=settings.OPENROUTER_DEFAULT_MODEL,
            site_url=getattr(settings, "SITE_URL", ""),
            app_name=getattr(settings, "APP_NAME", "Nexus"),
        )
    elif provider == "gemini":
        try:
            api_key = creds_store.get("GOOGLE_API_KEY")
        except Exception as e:
            logger.warning(
                "Failed to load GOOGLE_API_KEY from credentials: %s", e)
            return None

        if api_key is None:
            logger.warning("GOOGLE_API_KEY not found in credentials")
            return None

        return GeminiProvider(
            api_key=api_key,
            default_model=settings.GEMINI_DEFAULT_MODEL,
        )
    else:
        raise ValueError(
            f"Unknown LLM_PROVIDER='{provider}'. Valid options: groq, openrouter, gemini"
        )
