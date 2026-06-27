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
} from "../api/client.js";
import type {
  ConversationResponse,
  MessageResponse,
  Screen,
} from "../api/types.js";

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
  { trigger: "/help", label: "Help", description: "List all slash commands" },
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Chat({ onNavigate }: ChatProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 100;
  const rows = stdout?.rows ?? 30;

  const SIDEBAR_WIDTH = 26;
  const CHAT_WIDTH = Math.max(40, cols - SIDEBAR_WIDTH - 3);
  const MAX_MSG_LINES = rows - 10;
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
  const [streaming, setStreaming] = useState(false);
  const [streamPhase, setStreamPhase] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<(() => void) | null>(null);

  // ── command palette state ─────────────────────────────────────────
  const [cmdIndex, setCmdIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
          break;

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
                (c) => `${c.trigger.padEnd(10)} — ${c.description}`,
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
    // Navigate command palette with arrow keys (intercept before sidebar)
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

    // Tab switches panel
    if (key.tab) {
      setPanel((p) => (p === "sidebar" ? "chat" : "sidebar"));
      return;
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

  // ── Render: Sidebar ───────────────────────────────────────────────

  const renderSidebar = () => (
    <Box
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      borderStyle="round"
      borderColor={panel === "sidebar" ? "cyan" : "gray"}>
      <Box paddingX={1} borderStyle="single" borderColor="gray">
        <Text color="cyan" bold>
          💬 Chats
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {loadingConvs ? (
          <Box paddingX={1} gap={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text color="gray">Loading…</Text>
          </Box>
        ) : conversations.length === 0 ? (
          <Box paddingX={1}>
            <Text color="gray" dimColor>
              No conversations yet
            </Text>
          </Box>
        ) : (
          conversations.slice(0, rows - 8).map((conv, idx) => (
            <Box key={conv.id} paddingX={1}>
              <Text
                color={idx === sidebarIdx ? "cyan" : "gray"}
                bold={idx === sidebarIdx}
                wrap="truncate-end">
                {idx === sidebarIdx ? "▶ " : "  "}
                {shortTitle(conv.title, conv.id)}
              </Text>
            </Box>
          ))
        )}
      </Box>

      <Box paddingX={1} flexDirection="column">
        <Text color="gray" dimColor>
          ──────────────────────
        </Text>
        <Text color="gray" dimColor>
          ↑↓ navigate ↵ open
        </Text>
        <Text color="gray" dimColor>
          Tab → chat panel
        </Text>
      </Box>
    </Box>
  );

  // ── Render: Home screen (no messages) ────────────────────────────

  const renderHome = () => (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={1}>
      {LOGO.split("\n").map((line, i) => (
        <Text key={i} color="cyan" bold>
          {line}
        </Text>
      ))}
      <Text color="gray" dimColor>
        Self-hosted Personal AI Agent
      </Text>
      <Box marginTop={1} flexDirection="column" alignItems="center" gap={0}>
        <Text color="gray">How can I help you today?</Text>
        <Text color="gray" dimColor>
          Type a message or /help for commands
        </Text>
      </Box>
    </Box>
  );

  // ── Render: Messages ──────────────────────────────────────────────

  const renderMessages = () => {
    if (loadingMsgs) {
      return (
        <Box gap={1} paddingX={2} flexGrow={1}>
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

    const visible = allLines.slice(-MAX_MSG_LINES);
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {visible.map((line, i) => (
          <Text key={i} color={line.color as any} bold={line.bold} wrap="wrap">
            {line.text}
          </Text>
        ))}
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

  // ── Render: Input ─────────────────────────────────────────────────

  const isChatFocused = panel === "chat";

  const renderInput = () => (
    <Box
      borderStyle="round"
      borderColor={isChatFocused ? "cyan" : "gray"}
      paddingX={1}
      marginX={1}>
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
        <TextInput
          value={input}
          onChange={(val) => {
            setInput(val);
            if (deleteConfirm && !val) setDeleteConfirm(false);
          }}
          onSubmit={handleSubmit}
          focus={isChatFocused}
          placeholder="Message Nexus… or type / for commands"
        />
      )}
    </Box>
  );

  // ── Render: Chat panel ────────────────────────────────────────────

  const renderChatPanel = () => (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={isChatFocused ? "cyan" : "gray"}>
      {/* Messages / home */}
      {renderMessages()}

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
    <Box flexDirection="column" height={rows}>
      <Box flexDirection="row" flexGrow={1}>
        {renderSidebar()}
        {renderChatPanel()}
      </Box>

      <Footer
        hints={
          showPalette
            ? [
                { key: "↑↓", label: "select command" },
                { key: "Enter", label: "run" },
                { key: "Esc", label: "dismiss" },
              ]
            : panel === "sidebar"
              ? [
                  { key: "↑↓", label: "navigate" },
                  { key: "↵", label: "open" },
                  { key: "Tab", label: "→ chat" },
                  { key: "Esc", label: "menu" },
                ]
              : [
                  { key: "Enter", label: "send" },
                  { key: "/", label: "commands" },
                  { key: "Tab", label: "← sidebar" },
                ]
        }
      />
    </Box>
  );
}
