import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  StopCircle,
  BrainCircuit,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  useStreamingChat,
  type StreamPhase,
} from "../../hooks/useStreamingChat";
import { useQueryClient } from "@tanstack/react-query";
import { CONVERSATIONS_KEY } from "../../hooks/useConversations";
import { conversationApi } from "../../api/chat";

// ── Status indicator ──────────────────────────────────────────────────────────

const PHASE_LABEL: Record<StreamPhase, string> = {
  idle: "",
  thinking: "Thinking…",
  streaming: "Generating…",
  done: "",
  error: "Something went wrong",
};

function StatusPill({ phase }: { phase: StreamPhase }) {
  const show = phase === "thinking" || phase === "streaming";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="status"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium w-fit">
          <Loader2 className="w-3 h-3 animate-spin" />
          {PHASE_LABEL[phase]}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Typing cursor ─────────────────────────────────────────────────────────────

function TypingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
      className="inline-block w-[2px] h-[1em] bg-foreground align-text-bottom ml-0.5"
    />
  );
}

// ── Markdown-light renderer ───────────────────────────────────────────────────

function MessageContent({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const body = part.slice(3, -3);
          const nl = body.indexOf("\n");
          const lang = nl > -1 ? body.slice(0, nl) : "";
          const code = nl > -1 ? body.slice(nl + 1) : body;
          return (
            <pre
              key={i}
              className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto my-2 whitespace-pre">
              {lang && (
                <span className="text-muted-foreground block mb-1">{lang}</span>
              )}
              {code}
            </pre>
          );
        }
        return (
          <span key={i}>
            {part.split(/(\*\*.*?\*\*|`[^`]+`|\n)/g).map((seg, j) => {
              if (seg.startsWith("**") && seg.endsWith("**"))
                return <strong key={j}>{seg.slice(2, -2)}</strong>;
              if (seg.startsWith("`") && seg.endsWith("`"))
                return (
                  <code
                    key={j}
                    className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                    {seg.slice(1, -1)}
                  </code>
                );
              if (seg === "\n") return <br key={j} />;
              return <span key={j}>{seg}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  role,
  content,
  isStreaming,
}: {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mr-3 mt-1 shrink-0">
          <BrainCircuit className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border text-foreground rounded-tl-sm"
        }`}>
        {content ? (
          <>
            <MessageContent text={content} />
            {isStreaming && <TypingCursor />}
          </>
        ) : (
          <div className="flex items-center gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.2,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-left gap-8 pb-16 select-none font-mono">
      <div className="flex flex-col items-center gap-2 text-center mt-10">
        <h1 className="text-5xl font-bold tracking-[0.15em] text-muted-foreground uppercase opacity-80">
          Nexus
        </h1>
        <span className="text-muted-foreground/60 text-xs">v1.0.0</span>
      </div>

      <div className="flex flex-col gap-2 text-xs text-muted-foreground mt-4">
        <div className="flex items-center gap-8">
          <span className="text-primary min-w-[80px]">/help</span>
          <span>show help</span>
          <span className="ml-auto opacity-50">ctrl+h</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="text-primary min-w-[80px]">/editor</span>
          <span>open editor</span>
          <span className="ml-auto opacity-50">ctrl+e</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="text-primary min-w-[80px]">/models</span>
          <span>list models</span>
          <span className="ml-auto opacity-50">ctrl+m</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="text-primary min-w-[80px]">/init</span>
          <span>create/update AGENTS.md</span>
          <span className="ml-auto opacity-50">ctrl+i</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="text-primary min-w-[80px]">/compact</span>
          <span>compact the session</span>
          <span className="ml-auto opacity-50">ctrl+c</span>
        </div>
        <div className="flex items-center gap-8">
          <span className="text-primary min-w-[80px]">/sessions</span>
          <span>list sessions</span>
          <span className="ml-auto opacity-50">ctrl+l</span>
        </div>
      </div>
    </div>
  );
}

// ── Chat Thread ───────────────────────────────────────────────────────────────

export const ChatThread = () => {
  const { convId: convIdParam } = useParams<{ convId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  const {
    messages,
    streamState,
    convId: hookConvId,
    sendMessage,
    abort,
    loadMessages,
    resetMessages,
  } = useStreamingChat(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isActive =
    streamState.phase === "thinking" || streamState.phase === "streaming";

  // ── Load history when URL param changes ──────────────────────────────────
  useEffect(() => {
    if (!convIdParam) {
      // /chat — blank slate
      resetMessages(null);
      return;
    }
    setLoadingHistory(true);
    conversationApi
      .messages(convIdParam)
      .then((msgs) => loadMessages(msgs, convIdParam))
      .catch(() => {
        // Conversation not found or network error — go back to /chat
        navigate("/chat", { replace: true });
      })
      .finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convIdParam]);

  // ── Navigate to URL when the hook captures a new conv_id ─────────────────
  // This fires after the very first message in a new (unnamed) chat.
  useEffect(() => {
    if (hookConvId && hookConvId !== convIdParam) {
      navigate(`/chat/${hookConvId}`, { replace: true });
      // Refresh sidebar so the new conversation appears
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookConvId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isActive) return;
    setInput("");
    autoResize();
    await sendMessage(trimmed);
  }, [input, isActive, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-2 py-6 scroll-smooth">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg, idx) => {
            const isLastAssistant =
              msg.role === "assistant" && idx === messages.length - 1;
            const isDraftStreaming =
              isLastAssistant &&
              (streamState.phase === "streaming" ||
                streamState.phase === "thinking");
            return (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isStreaming={isDraftStreaming}
              />
            );
          })
        )}

        {/* Error banner */}
        <AnimatePresence>
          {streamState.phase === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-destructive px-4 py-2 bg-destructive/10 rounded-lg border border-destructive/20 mx-auto w-fit mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {streamState.errorDetail ?? "An error occurred"}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Status pill */}
      <div className="px-4 pb-2">
        <StatusPill phase={streamState.phase} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-6">
        <div className="flex flex-col font-mono w-full max-w-3xl mx-auto">
          <div className="flex items-start gap-3 bg-muted/30 focus-within:bg-muted/50 transition-colors border-l-[3px] border-transparent focus-within:border-primary px-4 py-3">
            <span className="text-primary font-bold mt-[2px]">{">"}</span>
            <textarea
              ref={textareaRef}
              id="chat-input"
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder=""
              disabled={isActive || loadingHistory}
              className="flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground leading-relaxed max-h-40 disabled:opacity-50 py-0.5"
            />
            {isActive && (
              <button
                onClick={abort}
                className="text-destructive hover:text-destructive/80 transition-colors shrink-0 px-2 mt-[2px]"
                aria-label="Stop generation">
                <StopCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground/60 mt-2 px-1">
            <span>enter send</span>
            <span>Nexus Assistant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
