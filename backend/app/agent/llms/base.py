from typing import AsyncGenerator, Any
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: str


@dataclass
class LLMMessage:
    role: str
    content: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    # Provider-specific opaque data that must survive round-trips.
    # GeminiProvider stores the raw Part list here so that thought blocks
    # (including thought_signature) can be replayed verbatim on the next turn.
    _gemini_parts: list | None = field(default=None, repr=False)

    def to_dict(self) -> dict:
        msg: dict[str, Any] = {"role": self.role, "content": self.content}

        if self.tool_calls:
            msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.name, "arguments": tc.arguments}
                }
                for tc in self.tool_calls
            ]
        if self._gemini_parts is not None:
            msg["_gemini_parts"] = self._gemini_parts
        return msg


@dataclass
class LLMResponse:
    msg: LLMMessage
    finish_reason: str | None


class LLMError(Exception):
    """Normalized error raised by any provider."""

    def __init__(self, code: str, detail: str):
        self.code = code
        self.detail = detail
        super().__init__(detail)


class BaseLLMProvider(ABC):
    """
    All providers must implement these two methods.
    The caller never sees SDK-specific types — only LLMResponse / LLMError.
    """

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Non-streaming completion. Raises LLMError on provider errors."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[dict],
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Yields token strings. Raises LLMError on provider errors."""
        ...
