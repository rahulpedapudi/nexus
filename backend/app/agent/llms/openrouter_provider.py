
from typing import Any, AsyncGenerator

from openai import AsyncOpenAI
from openai import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    PermissionDeniedError,
    RateLimitError,
)

from .base import BaseLLMProvider, LLMError, LLMMessage, LLMResponse, ToolCall


def _normalize_tool_calls(raw_tool_calls) -> list[ToolCall]:
    if not raw_tool_calls:
        return []
    return [
        ToolCall(
            id=tc.id,
            name=tc.function.name,
            arguments=tc.function.arguments,
        )
        for tc in raw_tool_calls
    ]


def _classify(exc: Exception) -> LLMError:
    mapping = {
        AuthenticationError:    ("auth_error",       "Invalid OpenRouter API key."),
        PermissionDeniedError:  ("permission_error", "Permission denied by OpenRouter."),
        RateLimitError:         ("rate_limit",        "Rate limit reached. Try again shortly."),
        APITimeoutError:        ("timeout",           "Request timed out."),
        BadRequestError:        ("bad_request",       f"Bad request: {exc}"),
        InternalServerError:    ("server_error",      "OpenRouter server error. Try again."),
        APIConnectionError:     ("connection_error",  "Could not reach OpenRouter."),
    }
    for exc_type, (code, detail) in mapping.items():
        if isinstance(exc, exc_type):
            return LLMError(code, detail)
    return LLMError("unknown_error", str(exc))


class OpenRouterProvider(BaseLLMProvider):
    def __init__(
        self,
        api_key: str,
        default_model: str = "",
        site_url: str = "",
        app_name: str = "Nexus"
    ):
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": site_url,
                "X-Title": app_name,
            },
        )
        self.default_model = default_model

    async def complete(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        try:
            resp = await self.client.chat.completions.create(
                model=model or self.default_model,
                messages=messages,
                tools=tools if tools else None,
                tool_choice="auto" if tools else None,
                **kwargs,
            )
        except (
            RateLimitError, AuthenticationError, PermissionDeniedError,
            APITimeoutError, BadRequestError, InternalServerError, APIConnectionError,
        ) as exc:
            raise _classify(exc) from exc

        choice = resp.choices[0]
        msg = choice.message
        return LLMResponse(
            msg=LLMMessage(
                role="assistant",
                content=msg.content,
                tool_calls=_normalize_tool_calls(msg.tool_calls),
            ),
            finish_reason=choice.finish_reason,
        )

    async def stream(
        self,
        messages: list[dict],
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        try:
            stream = await self.client.chat.completions.create(
                model=model or self.default_model,
                messages=messages,
                stream=True,
                **kwargs,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    yield token
        except (
            RateLimitError, AuthenticationError, PermissionDeniedError,
            APITimeoutError, BadRequestError, InternalServerError, APIConnectionError,
        ) as exc:
            raise _classify(exc) from exc
