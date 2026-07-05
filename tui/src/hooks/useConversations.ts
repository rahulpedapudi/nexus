import { useState, useEffect, useCallback, useRef } from "react";
import {
  listConversations,
  getMessages,
  deleteConversation,
  renameConversation,
  streamChat,
} from "../api/client.js";
import type { ConversationResponse, MessageResponse } from "../api/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationResponse[]>(
    [],
  );
  const [sidebarIdx, setSidebarIdx] = useState(-1);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamPhase, setStreamPhase] = useState("");
  const [activeTool, setActiveTool] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<(() => void) | null>(null);

  const activeConv =
    sidebarIdx >= 0 ? (conversations[sidebarIdx] ?? null) : null;

  // ── Load conversations ────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const convs = await listConversations();
      convs.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setConversations(convs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Load messages when active conversation changes ────────────────

  useEffect(() => {
    if (!activeConv) {
      setMessages([]);
      return;
    }
    setLoadingMsgs(true);
    setError("");
    getMessages(activeConv.id)
      .then((msgs: MessageResponse[]) =>
        setMessages(msgs.map((m) => ({ role: m.role, content: m.content }))),
      )
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setLoadingMsgs(false));
  }, [activeConv?.id]);

  // ── Send a message (streaming) ────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text || streaming) return;
      setError("");
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streaming: true },
      ]);
      setStreaming(true);
      setStreamPhase("thinking");

      let cancelled = false;
      abortRef.current = () => {
        cancelled = true;
      };

      try {
        const gen = streamChat({
          content: text,
          source: "tui",
          conv_id: activeConv?.id,
        });
        let accumulated = "";

        for await (const event of gen) {
          if (cancelled) break;
          if (event.type === "status") {
            setStreamPhase(event.phase);
            setActiveTool(event.phase === "tool_use" && event.tool ? event.tool : "");
          } else if (event.type === "delta") {
            accumulated += event.text;
            const snap = accumulated;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.streaming)
                next[next.length - 1] = {
                  role: "assistant",
                  content: snap,
                  streaming: true,
                };
              return next;
            });
          } else if (event.type === "done") {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.streaming)
                next[next.length - 1] = {
                  role: "assistant",
                  content: event.full_text,
                  streaming: false,
                };
              return next;
            });
            // Refresh sidebar if a new conversation was created
            if (!activeConv || event.conv_id !== activeConv.id) {
              const fresh = await listConversations().catch(() => null);
              if (fresh) {
                fresh.sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
                );
                setConversations(fresh);
                const idx = fresh.findIndex((c) => c.id === event.conv_id);
                if (idx >= 0) setSidebarIdx(idx);
              }
            }
          } else if (event.type === "error") {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.streaming)
                next[next.length - 1] = {
                  role: "assistant",
                  content: `⚠ ${event.detail}`,
                  streaming: false,
                };
              return next;
            });
            setError(event.detail);
          }
        }
      } catch (e) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming)
            next[next.length - 1] = {
              role: "assistant",
              content: `⚠ ${e instanceof Error ? e.message : String(e)}`,
              streaming: false,
            };
          return next;
        });
      } finally {
        setStreaming(false);
        setStreamPhase("");
        setActiveTool("");
        abortRef.current = null;
      }
    },
    [streaming, activeConv],
  );

  // ── Delete a conversation ─────────────────────────────────────────

  const removeConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      const updated = conversations.filter((c) => c.id !== id);
      setConversations(updated);
      setSidebarIdx(updated.length > 0 ? 0 : -1);
      setMessages([]);
    },
    [conversations],
  );

  // ── Rename a conversation ─────────────────────────────────────────

  const renameActiveConversation = useCallback(
    async (newTitle: string) => {
      if (!activeConv) return;
      const updated = await renameConversation(activeConv.id, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
    },
    [activeConv],
  );

  // ── Abort streaming ───────────────────────────────────────────────

  const cancelStream = useCallback(() => {
    abortRef.current?.();
  }, []);

  return {
    conversations,
    setConversations,
    sidebarIdx,
    setSidebarIdx,
    messages,
    setMessages,
    activeConv,
    loadingConvs,
    loadingMsgs,
    streaming,
    streamPhase,
    activeTool,
    error,
    setError,
    loadConversations,
    sendMessage,
    removeConversation,
    renameActiveConversation,
    cancelStream,
  };
}
