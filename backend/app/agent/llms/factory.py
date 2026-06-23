from .base import BaseLLMProvider
from .groq_provider import GroqProvider
from .openrouter_provider import OpenRouterProvider


def build_llm_provider(settings) -> BaseLLMProvider:
    """
    Reads LLM_PROVIDER from settings and returns the appropriate provider.
    Call once at startup and inject the instance wherever needed.
    """
    provider = settings.LLM_PROVIDER.lower()

    if provider == "groq":
        return GroqProvider(
            api_key=settings.GROQ_API_KEY,
            default_model=settings.GROQ_DEFAULT_MODEL,
        )
    elif provider == "openrouter":
        return OpenRouterProvider(
            api_key=settings.OPENROUTER_API_KEY,
            default_model=settings.OPENROUTER_DEFAULT_MODEL,
            site_url=getattr(settings, "SITE_URL", ""),
            app_name=getattr(settings, "APP_NAME", "Nexus"),
        )
    else:
        raise ValueError(
            f"Unknown LLM_PROVIDER='{provider}'. Valid options: groq, openrouter"
        )
