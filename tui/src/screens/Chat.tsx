import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";

import { Footer } from "../components/Footer.js";
import {
  listConversations,
  getMessages,
  deleteConversation,
  renameConversation,
  streamChat,
  getLLM,
} from "../api/client.js";
import type {
  ConversationResponse,
  MessageResponse,
  Screen,
} from "../api/types.js";
import { writeCredentials } from "../config.js";

// ---------------------------------------------------------------------------
// Slash commands
// ---------------------------------------------------------------------------

interface SlashCommand {
  trigger: string;
  label: string;
  description: string;
}

const COMMANDS: SlashCommand[] = [
  {
    trigger: "/new",
    label: "New conversation",
    description: "Start a fresh conversation",
  },
  {
    trigger: "/rename",
    label: "Rename",
    description: "Rename: /rename My New Title",
  },
  {
    trigger: "/delete",
    label: "Delete",
    description: "Delete this conversation",
  },
  {
    trigger: "/menu",
    label: "Main menu",
    description: "Navigate to the main menu",
  },
  {
    trigger: "/provider",
    label: "LLM Provider",
    description: "Change LLM provider",
  },
  { trigger: "/help", label: "Help", description: "List all slash commands" },
  {
    trigger: "/conversation",
    label: "Search conversations",
    description: "Search and switch conversations",
  },
];

function filterCommands(input: string): SlashCommand[] {
  if (!input.startsWith("/")) return [];
  const query = input.split(" ")[0]!.slice(1).toLowerCase();
  if (query === "") return COMMANDS;
  return COMMANDS.filter((c) => c.trigger.slice(1).startsWith(query));
}

function matchExact(input: string): SlashCommand | null {
  const trigger = input.trim().split(" ")[0]!;
  return COMMANDS.find((c) => c.trigger === trigger) ?? null;
}

// ---------------------------------------------------------------------------
// Types / helpers
// ---------------------------------------------------------------------------

type Panel = "sidebar" | "chat";

interface LocalMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (!rawLine) {
      lines.push("");
      continue;
    }
    let rem = rawLine;
    while (rem.length > maxWidth) {
      let cut = rem.lastIndexOf(" ", maxWidth);
      if (cut <= 0) cut = maxWidth;
      lines.push(rem.slice(0, cut));
      rem = rem.slice(cut).trimStart();
    }
    if (rem) lines.push(rem);
  }
  return lines;
}

function shortTitle(t: string | null, id: string): string {
  if (!t) return `conv-${id.slice(0, 6)}`;
  return t.length > 22 ? t.slice(0, 21) + "…" : t;
}

const LOGO = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`.trim();

interface ChatProps {
  onNavigate: (screen: Screen) => void;
}

type LLMProps = {
  llm: string;
  model: string;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Chat({ onNavigate }: ChatProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 100;
  const rows = stdout?.rows ?? 30;

  const SIDEBAR_WIDTH = 26;
  const CHAT_WIDTH = Math.max(40, cols - SIDEBAR_WIDTH - 3);
  const MSG_WIDTH = CHAT_WIDTH - 6;

  // ── core state ────────────────────────────────────────────────────
  const [panel, setPanel] = useState<Panel>("chat");
  const [conversations, setConversations] = useState<ConversationResponse[]>(
    [],
  );
  const [sidebarIdx, setSidebarIdx] = useState(-1); // -1 = home / no selection
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingLLM, setLoadingLLM] = useState(false);
  const [llm, setllm] = useState<LLMProps>();

  const [streaming, setStreaming] = useState(false);
  const [streamPhase, setStreamPhase] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<(() => void) | null>(null);

  // ── command palette state ─────────────────────────────────────────
  const [cmdIndex, setCmdIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ── scroll state ──────────────────────────────────────────────────
  // scrollOffset=0 means pinned to bottom; positive = lines scrolled up
  const [scrollOffset, setScrollOffset] = useState(0);
  const prevMsgCount = useRef(0);

  // ── /conversation search state ────────────────────────────────────
  const [convSearchOpen, setConvSearchOpen] = useState(false);
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [convSearchIdx, setConvSearchIdx] = useState(0);

  const palette = filterCommands(input);
  const showPalette = palette.length > 0 && !streaming;

  const activeConv =
    sidebarIdx >= 0 ? (conversations[sidebarIdx] ?? null) : null;

  // ── load conversations ────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const convs = await listConversations();
      convs.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setConversations(convs);
      // Don't auto-select — stay on home screen
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const getCurrentLLM = useCallback(async () => {
    setLoadingLLM(true);
    try {
      const res = await getLLM();
      setllm(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingLLM(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    getCurrentLLM();
  }, [loadConversations]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length !== prevMsgCount.current) {
      prevMsgCount.current = messages.length;
      setScrollOffset(0);
    }
  }, [messages.length]);

  // ── load messages when sidebar selection changes ───────────────────

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

  // ── send message ──────────────────────────────────────────────────

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
            // Refresh sidebar if a new conv was created
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
        abortRef.current = null;
      }
    },
    [streaming, activeConv],
  );

  // ── execute a slash command ───────────────────────────────────────

  const executeCommand = useCallback(
    async (cmd: SlashCommand, args: string) => {
      setInput("");
      setCmdIndex(0);
      setDeleteConfirm(false);

      switch (cmd.trigger) {
        case "/new":
          setMessages([]);
          setSidebarIdx(-1);
          setPanel("chat");
          setScrollOffset(0);
          break;

        case "/conversation":
          setConvSearchOpen(true);
          setConvSearchQuery("");
          setConvSearchIdx(0);
          break;

        case "/provider": {
          const provider = args.trim();
          if (!provider) {
            setError("Usage: /provider <provider>");
            break;
          }
          try {
            writeCredentials({ LLM_PROVIDER: provider });
            await getCurrentLLM();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          break;
        }

        case "/rename": {
          if (!activeConv) {
            setError("No conversation selected.");
            break;
          }
          const newTitle = args.trim();
          if (!newTitle) {
            setError("Usage: /rename My New Title");
            break;
          }
          try {
            const updated = await renameConversation(activeConv.id, newTitle);
            setConversations((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          break;
        }

        case "/delete":
          if (!activeConv) {
            setError("No conversation selected.");
            break;
          }
          setDeleteConfirm(true);
          break;

        case "/menu":
          onNavigate("main-menu");
          break;

        case "/help":
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: COMMANDS.map(
                (c) => `${c.trigger.padEnd(16)} — ${c.description}`,
              ).join("\n"),
            },
          ]);
          break;
      }
    },
    [activeConv, onNavigate],
  );

  // ── handle TextInput submit (Enter key) ───────────────────────────

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      // Delete confirm flow
      if (deleteConfirm) {
        if (trimmed.toLowerCase() === "yes" || trimmed === "y") {
          if (activeConv) {
            deleteConversation(activeConv.id)
              .then(() => {
                const updated = conversations.filter(
                  (c) => c.id !== activeConv.id,
                );
                setConversations(updated);
                setSidebarIdx(updated.length > 0 ? 0 : -1);
                setMessages([]);
              })
              .catch((e) =>
                setError(e instanceof Error ? e.message : String(e)),
              );
          }
        }
        setDeleteConfirm(false);
        setInput("");
        return;
      }

      // If palette is visible and a command is highlighted, execute it
      if (showPalette) {
        const selected = palette[cmdIndex] ?? palette[0];
        if (selected) {
          const exact = matchExact(trimmed);
          if (exact) {
            // Has exact match — use args from input
            const args = trimmed.slice(exact.trigger.length).trim();
            executeCommand(exact, args);
          } else {
            executeCommand(selected, "");
          }
          return;
        }
      }

      // Regular message
      setInput("");
      sendMessage(trimmed);
    },
    [
      deleteConfirm,
      showPalette,
      palette,
      cmdIndex,
      activeConv,
      conversations,
      executeCommand,
      sendMessage,
    ],
  );

  // ── keyboard handling ─────────────────────────────────────────────

  useInput((ch, key) => {
    // ── Conversation search modal ────────────────────────────────────
    if (convSearchOpen) {
      if (key.escape) {
        setConvSearchOpen(false);
        setConvSearchQuery("");
        return;
      }
      const filtered = conversations.filter(
        (c) =>
          (c.title ?? "")
            .toLowerCase()
            .includes(convSearchQuery.toLowerCase()) ||
          c.id.startsWith(convSearchQuery),
      );
      if (key.upArrow) {
        setConvSearchIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setConvSearchIdx((i) => Math.min(filtered.length - 1, i + 1));
        return;
      }
      if (key.return) {
        const chosen = filtered[convSearchIdx];
        if (chosen) {
          const idx = conversations.indexOf(chosen);
          setSidebarIdx(idx);
          setPanel("chat");
          setScrollOffset(0);
        }
        setConvSearchOpen(false);
        setConvSearchQuery("");
        return;
      }
      if (key.backspace || key.delete) {
        setConvSearchQuery((q) => q.slice(0, -1));
        setConvSearchIdx(0);
        return;
      }
      if (ch && !key.ctrl && !key.meta && ch.length === 1) {
        setConvSearchQuery((q) => q + ch);
        setConvSearchIdx(0);
        return;
      }
      return;
    }

    // ── Command palette arrow navigation ─────────────────────────────
    if (showPalette) {
      if (key.upArrow) {
        setCmdIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setCmdIndex((i) => Math.min(palette.length - 1, i + 1));
        return;
      }
      if (key.escape) {
        setInput("");
        setCmdIndex(0);
        return;
      }
    }

    // Delete confirm: Esc to cancel
    if (deleteConfirm && key.escape) {
      setDeleteConfirm(false);
      setInput("");
      return;
    }

    // ── Scroll messages (Ctrl+Up / Ctrl+Down in chat panel) ───────────
    if (panel === "chat" && !showPalette && !deleteConfirm) {
      if (key.upArrow && key.ctrl) {
        setScrollOffset((o) => o + 3);
        return;
      }
      if (key.downArrow && key.ctrl) {
        setScrollOffset((o) => Math.max(0, o - 3));
        return;
      }
      if (key.pageUp) {
        setScrollOffset((o) => o + 10);
        return;
      }
      if (key.pageDown) {
        setScrollOffset((o) => Math.max(0, o - 10));
        return;
      }
    }

    // Escape
    if (key.escape) {
      if (panel === "chat") setPanel("sidebar");
      else onNavigate("main-menu");
      return;
    }

    // Sidebar arrow navigation
    if (panel === "sidebar") {
      if (key.upArrow) {
        setSidebarIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSidebarIdx((i) => Math.min(conversations.length - 1, i + 1));
        return;
      }
      if (key.return && sidebarIdx >= 0) {
        setPanel("chat");
        return;
      }
    }

    // Cancel streaming
    if (panel === "chat" && key.ctrl && ch === "c" && streaming) {
      abortRef.current?.();
    }
  });

  // Reset cmdIndex when palette changes
  useEffect(() => {
    setCmdIndex(0);
  }, [input]);

  // ── Render: Home screen (no messages) ────────────────────────────

  const renderHome = () => (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={1}>
      <Box flexDirection="column" marginBottom={2} alignItems="center">
        {LOGO.split("\n").map((line, i) => (
          <Text key={i} color="gray" dimColor={false} bold>
            {line}
          </Text>
        ))}
        <Text color="gray" dimColor>
          v1.0.0
        </Text>
      </Box>

      {/* <Box marginTop={2} flexDirection="column" gap={0} alignItems="flex-start">
        {COMMANDS.map((c) => (
          <Box key={c.trigger} paddingX={2}>
            <Box width={15}>
              <Text color="cyan" bold>
                {c.trigger}
              </Text>
            </Box>
            <Text color="gray">{c.label}</Text>
          </Box>
        ))}
      </Box> */}
    </Box>
  );

  // ── Render: Messages ──────────────────────────────────────────────

  // Fixed height budget for messages area
  const INPUT_HEIGHT = 6; // input box + hints row + padding
  const PALETTE_HEIGHT = showPalette ? Math.min(palette.length + 2, 8) : 0;
  const ERROR_HEIGHT = error ? 1 : 0;
  const MSG_AREA_HEIGHT = Math.max(
    4,
    rows - INPUT_HEIGHT - PALETTE_HEIGHT - ERROR_HEIGHT - 2,
  );

  const renderMessages = () => {
    if (loadingMsgs) {
      return (
        <Box gap={1} paddingX={2} height={MSG_AREA_HEIGHT} overflow="hidden">
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="gray">Loading messages…</Text>
        </Box>
      );
    }
    if (messages.length === 0) return renderHome();

    const allLines: Array<{ color: string; text: string; bold?: boolean }> = [];
    for (const msg of messages) {
      const isUser = msg.role === "user";
      const label = isUser
        ? "You"
        : msg.streaming
          ? `◌ Nexus [${streamPhase}]`
          : "◉ Nexus";
      allLines.push({
        color: isUser ? "cyan" : "green",
        text: label,
        bold: true,
      });
      for (const line of wrapText(msg.content || "…", MSG_WIDTH)) {
        allLines.push({ color: "white", text: "  " + line });
      }
      allLines.push({ color: "gray", text: "" });
    }

    // Clamp scroll offset so we never scroll past the top
    const maxOffset = Math.max(0, allLines.length - MSG_AREA_HEIGHT);
    const clampedOffset = Math.min(scrollOffset, maxOffset);
    const startIdx = Math.max(
      0,
      allLines.length - MSG_AREA_HEIGHT - clampedOffset,
    );
    const visible = allLines.slice(startIdx, startIdx + MSG_AREA_HEIGHT);

    const atBottom = clampedOffset === 0;
    const atTop = clampedOffset >= maxOffset;

    return (
      <Box
        flexDirection="column"
        height={MSG_AREA_HEIGHT}
        overflow="hidden"
        paddingX={1}>
        {!atTop && allLines.length > MSG_AREA_HEIGHT && (
          <Text color="gray" dimColor>
            {" "}
            ↑ more above (Ctrl+↑ / PgUp to scroll)
          </Text>
        )}
        {visible.map((line, i) => (
          <Text key={i} color={line.color as any} bold={line.bold} wrap="wrap">
            {line.text}
          </Text>
        ))}
        {!atBottom && (
          <Text color="gray" dimColor>
            {" "}
            ↓ more below (Ctrl+↓ / PgDn)
          </Text>
        )}
      </Box>
    );
  };

  // ── Render: Command palette ───────────────────────────────────────

  const renderPalette = () => {
    if (deleteConfirm) {
      return (
        <Box
          flexDirection="column"
          marginX={1}
          borderStyle="round"
          borderColor="red"
          paddingX={1}>
          <Text color="red" bold>
            ⚠ Delete "
            {shortTitle(activeConv?.title ?? null, activeConv?.id ?? "")}"?
          </Text>
          <Text color="gray" dimColor>
            Type <Text color="yellow">yes</Text> and press Enter to confirm, or
            Esc to cancel.
          </Text>
        </Box>
      );
    }

    if (!showPalette) return null;

    return (
      <Box
        flexDirection="column"
        marginX={1}
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}>
        {palette.map((cmd, i) => {
          const isHighlighted = i === cmdIndex;
          return (
            <Box key={cmd.trigger} gap={2}>
              <Text
                color={isHighlighted ? "cyan" : "gray"}
                bold={isHighlighted}>
                {isHighlighted ? "▶ " : "  "}
                {cmd.trigger.padEnd(10)}
              </Text>
              <Text
                color={isHighlighted ? "white" : "gray"}
                dimColor={!isHighlighted}>
                {cmd.description}
              </Text>
            </Box>
          );
        })}
      </Box>
    );
  };

  // ── Render: Conversation search modal ────────────────────────────

  const renderConvSearch = () => {
    if (!convSearchOpen) return null;
    const filtered = conversations.filter(
      (c) =>
        (c.title ?? "").toLowerCase().includes(convSearchQuery.toLowerCase()) ||
        c.id.startsWith(convSearchQuery),
    );
    const MAX_VISIBLE = Math.min(8, rows - 10);
    const startI = Math.max(0, convSearchIdx - MAX_VISIBLE + 1);
    const visible = filtered.slice(startI, startI + MAX_VISIBLE);

    return (
      <Box
        flexDirection="column"
        marginX={2}
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}>
        <Box gap={1} marginBottom={1}>
          <Text color="cyan" bold>
            🔍
          </Text>
          <Text color="cyan" bold>
            {convSearchQuery || " "}
          </Text>
          <Text color="gray" dimColor>
            — type to filter conversations
          </Text>
        </Box>
        {filtered.length === 0 ? (
          <Text color="gray" dimColor>
            {" "}
            No conversations match
          </Text>
        ) : (
          visible.map((conv, i) => {
            const realIdx = startI + i;
            const isSelected = realIdx === convSearchIdx;
            return (
              <Box key={conv.id}>
                <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>
                  {isSelected ? "▶ " : "  "}
                  {shortTitle(conv.title, conv.id)}
                </Text>
              </Box>
            );
          })
        )}
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            ↑↓ navigate ↵ open esc dismiss
          </Text>
        </Box>
      </Box>
    );
  };

  // ── Render: Input ─────────────────────────────────────────────────

  const isChatFocused = panel === "chat";

  const renderInput = () => (
    <Box flexDirection="column" marginX={1} marginTop={1} paddingBottom={1}>
      <Box
        // borderStyle="single"z
        borderLeftColor="cyan"
        borderLeft={true}
        flexDirection="row"
        paddingX={1}
        paddingY={1}>
        <Box marginRight={1}>
          <Text color="cyan" bold>
            {">"}
          </Text>
        </Box>
        {streaming ? (
          <Box gap={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text color="gray">
              {streamPhase === "thinking" ? "Thinking…" : "Streaming…"}
            </Text>
            <Text color="gray" dimColor>
              Ctrl+C to cancel
            </Text>
          </Box>
        ) : (
          <Box flexGrow={1}>
            <TextInput
              value={input}
              onChange={(val) => {
                setInput(val);
                if (deleteConfirm && !val) setDeleteConfirm(false);
              }}
              onSubmit={handleSubmit}
              focus={isChatFocused}
              placeholder=""
            />
          </Box>
        )}
      </Box>

      <Box
        flexDirection="row"
        justifyContent="space-between"
        paddingX={1}
        marginTop={1}>
        <Box flexDirection="row" gap={2}>
          {showPalette ? (
            <>
              <Text color="gray">
                <Text color="white">↑↓</Text> select command
              </Text>
              <Text color="gray">
                <Text color="white">enter</Text> run
              </Text>
              <Text color="gray">
                <Text color="white">esc</Text> dismiss
              </Text>
            </>
          ) : (
            <>
              <Text color="gray">
                <Text color="white">enter</Text> send
              </Text>
              <Text color="gray">
                <Text color="white">/</Text> commands
              </Text>
            </>
          )}
        </Box>
        {loadingLLM ? (
          <>
            <Spinner type="dots" />
          </>
        ) : (
          <Text color="gray" dimColor>
            {llm?.llm} - {llm?.model}
          </Text>
        )}
      </Box>
    </Box>
  );

  // ── Render: Chat panel ────────────────────────────────────────────

  const renderChatPanel = () => (
    <Box flexDirection="column" flexGrow={1}>
      {/* Messages / home */}
      {renderMessages()}

      {/* Conversation search modal */}
      {renderConvSearch()}

      {/* Error */}
      {error && (
        <Box paddingX={2}>
          <Text color="red" dimColor>
            ⚠ {error}
          </Text>
        </Box>
      )}

      {/* Command palette — sits above input */}
      {renderPalette()}

      {/* Input */}
      {renderInput()}
    </Box>
  );

  // ── Root layout ───────────────────────────────────────────────────

  return (
    <Box flexDirection="column" height={rows} overflow="hidden">
      <Box flexDirection="row" flexGrow={1} overflow="hidden">
        {/* {renderSidebar()} */}
        {renderChatPanel()}
      </Box>
    </Box>
  );
}
