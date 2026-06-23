from typing import Any, AsyncGenerator

from groq import AsyncGroq
from groq import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    PermissionDeniedError,
    RateLimitError,
)

from .base import LLMMessage, LLMResponse, BaseLLMProvider, LLMError, ToolCall


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
        AuthenticationError:    ("auth_error",       "Invalid API key."),
        PermissionDeniedError:  ("permission_error", "Permission denied by Groq."),
        RateLimitError:         ("rate_limit",        "Rate limit reached. Try again shortly."),
        APITimeoutError:        ("timeout",           "Request timed out."),
        BadRequestError:        ("bad_request",       f"Bad request: {exc}"),
        InternalServerError:    ("server_error",      "Groq server error. Try again."),
        APIConnectionError:     ("connection_error",  "Could not reach Groq."),
    }
    for exc_type, (code, detail) in mapping.items():
        if isinstance(exc, exc_type):
            return LLMError(code, detail)
    return LLMError("unknown_error", str(exc))


class GroqProvider(BaseLLMProvider):
    def __init__(self, api_key: str, default_model: str = "openai/gpt-oss-20b"):
        self.client = AsyncGroq(api_key=api_key)
        self.model = default_model

    async def complete(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        try:
            resp = await self.client.chat.completions.create(
                model=model or self.model,
                messages=messages,
                tools=tools or [],
                tool_choice="auto" if tools else "none",
                **kwargs,
            )
        except (
            RateLimitError, AuthenticationError, PermissionDeniedError,
            APITimeoutError, BadRequestError, InternalServerError, APIConnectionError,
        ) as exc:
            raise _classify(exc) from exc

        choice = resp.choices[0]
        msg = choice.message

        content = msg.content if msg.content is not None else ""
        tool_calls = _normalize_tool_calls(msg.tool_calls)
        finish_reason = choice.finish_reason

        return LLMResponse(
            msg=LLMMessage(
                role="assistant",
                content=content,
                tool_calls=tool_calls
            ),
            finish_reason=finish_reason
        )

    async def stream(
        self,
        messages: list[dict],
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        try:
            stream = await self.client.chat.completions.create(
                model=model or self.model,
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
