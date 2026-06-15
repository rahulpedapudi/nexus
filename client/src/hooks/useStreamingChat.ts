import { useState, useRef, useCallback } from "react";
import type { MessageResponse } from "../api/chat";

// ── SSE event types (mirrors backend event shapes) ────────────────────────────

export type StreamPhase = "idle" | "thinking" | "streaming" | "done" | "error";

interface StatusEvent {
  type: "status";
  phase: "thinking" | "streaming" | "done";
}
interface DeltaEvent {
  type: "delta";
  text: string;
}
interface DoneEvent {
  type: "done";
  message_id: string;
  conv_id: string;
}
interface ErrorEvent {
  type: "error";
  detail: string;
}

type SSEEvent = StatusEvent | DeltaEvent | DoneEvent | ErrorEvent;

// ── Message types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Persisted message ID from backend (only set on assistant messages after done) */
  persistedId?: string;
}

// ── Stream state ──────────────────────────────────────────────────────────────

export interface StreamState {
  phase: StreamPhase;
  errorDetail: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:8000";

/** Convert backend MessageResponse objects into local ChatMessage shape */
function hydrate(msgs: MessageResponse[]): ChatMessage[] {
  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    persistedId: m.id,
  }));
}

export function useStreamingChat(initialConvId: string | null = null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamState, setStreamState] = useState<StreamState>({
    phase: "idle",
    errorDetail: null,
  });
  // convId is managed internally; it may be seeded from outside or captured from
  // the first "done" SSE event when the backend auto-creates the conversation.
  const [convId, setConvId] = useState<string | null>(initialConvId);

  // We track the draft assistant message by a stable ref-based ID so we can
  // update it in-place via functional setState without closure issues.
  const draftIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Mirror of convId for synchronous reads inside async callbacks
  const convIdRef = useRef<string | null>(initialConvId);

  // ── Public helpers ────────────────────────────────────────────────────────

  /**
   * Load an existing conversation into local state.
   * Called when the user switches to a persisted conversation from the sidebar.
   */
  const loadMessages = useCallback(
    (msgs: MessageResponse[], newConvId: string) => {
      setMessages(hydrate(msgs));
      setConvId(newConvId);
      convIdRef.current = newConvId;
      setStreamState({ phase: "idle", errorDetail: null });
    },
    [],
  );

  /** Reset to a blank slate (new conversation). */
  const resetMessages = useCallback((newConvId: string | null = null) => {
    setMessages([]);
    setConvId(newConvId);
    convIdRef.current = newConvId;
    setStreamState({ phase: "idle", errorDetail: null });
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      if (streamState.phase === "thinking" || streamState.phase === "streaming") return;

      // ── 1. Append the user message immediately ────────────────────────────
      const userMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content },
      ]);

      // ── 2. Append a blank assistant placeholder ───────────────────────────
      const draftId = crypto.randomUUID();
      draftIdRef.current = draftId;
      setMessages((prev) => [
        ...prev,
        { id: draftId, role: "assistant", content: "" },
      ]);

      // ── 3. Reset stream state ─────────────────────────────────────────────
      setStreamState({ phase: "thinking", errorDetail: null });

      // ── 4. Open SSE stream via fetch (EventSource doesn't support POST/auth)
      abortRef.current = new AbortController();
      const token = localStorage.getItem("access_token");

      // Read convId synchronously from the ref (state reads inside async
      // callbacks are stale closures; the ref is always current).
      const currentConvId = convIdRef.current;

      let response: Response;
      try {
        response = await fetch(`${BASE_URL}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content,
            source: "web",
            ...(currentConvId ? { conv_id: currentConvId } : {}),
          }),
          signal: abortRef.current.signal,
        });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setStreamState({ phase: "error", errorDetail: "Network error" });
        _removeDraft(draftId);
        return;
      }

      if (!response.ok || !response.body) {
        setStreamState({ phase: "error", errorDetail: "Stream failed to open" });
        _removeDraft(draftId);
        return;
      }

      // ── 5. Read the readable stream line-by-line ──────────────────────────
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += value;
          const lines = buffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;

            let event: SSEEvent;
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }

            _handleEvent(event, draftId);
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setStreamState({ phase: "error", errorDetail: "Stream read error" });
        }
      } finally {
        reader.releaseLock();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streamState.phase],
  );

  // ── Internal event dispatcher ─────────────────────────────────────────────

  function _handleEvent(event: SSEEvent, draftId: string) {
    switch (event.type) {
      case "status":
        setStreamState((s) => ({
          ...s,
          phase: event.phase === "done" ? "done" : event.phase,
        }));
        break;

      case "delta":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === draftId ? { ...m, content: m.content + event.text } : m,
          ),
        );
        break;

      case "done":
        // Capture the conv_id returned by the backend (auto-created or existing)
        setConvId(event.conv_id);
        convIdRef.current = event.conv_id;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === draftId ? { ...m, persistedId: event.message_id } : m,
          ),
        );
        setStreamState({ phase: "idle", errorDetail: null });
        break;

      case "error":
        setStreamState({ phase: "error", errorDetail: event.detail });
        _removeDraft(draftId);
        break;
    }
  }

  function _removeDraft(draftId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== draftId));
  }

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStreamState({ phase: "idle", errorDetail: null });
  }, []);

  return {
    messages,
    streamState,
    convId,
    sendMessage,
    abort,
    loadMessages,
    resetMessages,
    setMessages,
  };
}
