import json
from typing import Any, AsyncGenerator
from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError, ServerError
from app.core.config import settings
from .base import LLMMessage, LLMResponse, BaseLLMProvider, LLMError, ToolCall


def _classify(exc: APIError) -> LLMError:
    """Map a google-genai APIError to a normalised LLMError.

    The SDK raises ClientError (4xx) or ServerError (5xx); we further
    distinguish by HTTP status code so callers get actionable codes.
    """
    code = getattr(exc, "code", 0) or 0
    status = getattr(exc, "status", "") or ""
    message = getattr(exc, "message", None) or str(exc)

    if isinstance(exc, ClientError):
        if code == 401:
            return LLMError("auth_error", "Invalid Gemini API key.")
        if code == 403:
            return LLMError("permission_error", "Permission denied by Gemini API.")
        if code == 404:
            return LLMError("not_found", f"Model or resource not found: {message}")
        if code == 429:
            return LLMError("rate_limit", "Gemini rate limit reached. Try again shortly.")
        if code == 400:
            # Surface the raw message — includes useful detail for INVALID_ARGUMENT,
            # FAILED_PRECONDITION, thought_signature errors, etc.
            return LLMError("bad_request", f"Bad request ({status}): {message}")
        return LLMError("client_error", f"Gemini client error {code}: {message}")

    if isinstance(exc, ServerError):
        if code == 503:
            return LLMError("service_unavailable", "Gemini is temporarily unavailable. Try again later.")
        if code == 504:
            return LLMError("timeout", "Gemini request timed out.")
        return LLMError("server_error", f"Gemini server error {code}. Try again later.")

    # Fallback for bare APIError (shouldn't normally happen)
    return LLMError("api_error", f"Gemini API error {code}: {message}")


def _to_gemini_tools(tools: list[dict] | None) -> list[dict]:
    """Convert OpenAI-style tool schemas to Gemini FunctionDeclaration dicts.

    OpenAI format:  {"type": "function", "function": {"name": ..., ...}}
    Gemini format:  {"name": ..., "description": ..., "parameters": ...}
    """
    if not tools:
        return []
    return [t["function"] for t in tools]


def _to_gemini_contents(messages: list[dict]) -> list[types.Content]:
    """Convert OpenAI-style message dicts to Gemini Content objects.

    OpenAI roles → Gemini roles:
      user      → user
      assistant → model  (may include FunctionCall parts for tool calls)
      tool      → user   (FunctionResponse part)

    If an assistant message carries ``_gemini_parts`` (set by this provider on
    a previous turn), those raw Part objects are replayed verbatim.  This is
    required for thinking models: Gemini embeds a ``thought_signature`` inside
    thought parts, and the API rejects requests where signed parts have been
    reconstructed or stripped from the history.
    """
    contents = []
    for msg in messages:
        role = msg.get("role", "")
        if hasattr(role, "value"):
            role = role.value  # unwrap enum

        if role == "tool":
            try:
                result = json.loads(msg.get("content", "null"))
            except Exception:
                result = msg.get("content", "")
            part = types.Part(
                function_response=types.FunctionResponse(
                    name=msg.get("name", msg.get("tool_call_id", "tool")),
                    response={"result": result},
                )
            )
            contents.append(types.Content(role="user", parts=[part]))

        elif role == "assistant":
            # Fast path: replay the exact parts Gemini gave us last time.
            # This is the only safe way to preserve thought_signature fields.
            raw_parts = msg.get("_gemini_parts")
            if raw_parts is not None:
                contents.append(types.Content(role="model", parts=raw_parts))
                continue

            # Fallback: reconstruct from OpenAI-style fields (non-thinking
            # models, or messages that didn't come from this provider).
            parts = []
            text = msg.get("content") or ""
            if text:
                parts.append(types.Part(text=text))
            for tc in msg.get("tool_calls", []):
                fn = tc.get("function", {})
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                except Exception:
                    args = {}
                parts.append(types.Part(
                    function_call=types.FunctionCall(
                        name=fn.get("name", ""),
                        args=args,
                    )
                ))
            if parts:
                contents.append(types.Content(role="model", parts=parts))

        else:  # user or any unknown role
            text = msg.get("content") or ""
            contents.append(types.Content(
                role="user",
                parts=[types.Part(text=text)],
            ))

    return contents


def _normalize_tool_calls(parts: list) -> list[ToolCall]:
    """Extract FunctionCall parts from a Gemini response part list."""
    if not parts:
        return []
    result = []
    for part in parts:
        fc = getattr(part, "function_call", None)
        if fc is not None:
            result.append(ToolCall(
                id=getattr(fc, "id", fc.name),
                name=fc.name,
                arguments=json.dumps(fc.args or {}),  # dict → JSON string
            ))
    return result


GEMINI_API_KEY = settings.GOOGLE_API_KEY


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, default_model: str = "gemini-3.5-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model = default_model

    async def complete(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        formatted_tools = types.Tool(
            function_declarations=_to_gemini_tools(tools))
        system_msg = messages[0]["content"]
        contents = _to_gemini_contents(messages[1:])
        try:
            resp = await self.client.aio.models.generate_content(
                model=model or self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    tools=[formatted_tools],
                    system_instruction=system_msg,
                    # Disable thinking only when actively dispatching tools.
                    # On turns where _gemini_parts are replayed verbatim the
                    # signatures are already embedded, so thinking can stay on.
                    # When tools fire without thinking disabled the API would
                    # embed a thought_signature we can't later reconstruct —
                    # but since we store raw parts that's no longer an issue;
                    # budget=0 here is a belt-and-suspenders guard.
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=0) if tools else None,
                ),
                **kwargs,
            )
        except APIError as exc:
            raise _classify(exc) from exc
        except Exception as exc:
            raise LLMError("unknown_error", str(exc)) from exc

        candidate = resp.candidates[0]
        parts = candidate.content.parts if candidate.content else []
        tool_calls = _normalize_tool_calls(parts)
        content = resp.text or ""

        return LLMResponse(
            msg=LLMMessage(
                role="assistant",
                content=content,
                tool_calls=tool_calls,
                # Preserve the raw parts so that thought_signature fields
                # survive when this message is replayed as history.
                _gemini_parts=list(parts) if parts else None,
            ),
            finish_reason=str(
                candidate.finish_reason) if candidate.finish_reason else None,
        )

    async def stream(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        formatted_tools = types.Tool(
            function_declarations=_to_gemini_tools(tools))
        system_msg = messages[0]["content"]
        contents = _to_gemini_contents(messages[1:])
        try:
            async for chunk in self.client.aio.models.generate_content_stream(
                model=model or self.model,
                config=types.GenerateContentConfig(
                    tools=[formatted_tools],
                    system_instruction=system_msg,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=0) if tools else None,
                ),
                contents=contents,
                **kwargs,
            ):
                if chunk.text:
                    yield chunk.text
        except APIError as exc:
            raise _classify(exc) from exc
        except Exception as exc:
            raise LLMError("unknown_error", str(exc)) from exc
