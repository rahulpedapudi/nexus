import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useStdout } from "ink";

import { Footer } from "../components/Footer.js";
import { getLLM } from "../api/client.js";
import { writeCredentials } from "../config.js";
import type { Screen } from "../api/types.js";

import { useConversations } from "../hooks/useConversations.js";
import { MessageList } from "./chat/MessageList.js";
import { CommandPalette } from "./chat/CommandPalette.js";
import { ConvSearchModal } from "./chat/ConvSearchModal.js";
import { ChatInput } from "./chat/ChatInput.js";
import {
  COMMANDS,
  filterCommands,
  matchExact,
} from "./chat/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatProps {
  onNavigate: (screen: Screen) => void;
}

type LLMInfo = { llm: string; model: string };

function shortTitle(t: string | null, id: string): string {
  if (!t) return `conv-${id.slice(0, 6)}`;
  return t.length > 22 ? t.slice(0, 21) + "…" : t;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Chat({ onNavigate }: ChatProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 100;
  const rows = stdout?.rows ?? 30;

  const CHAT_WIDTH = Math.max(40, cols - 3);
  const MSG_WIDTH = CHAT_WIDTH - 6;

  // ── Conversations / messaging ─────────────────────────────────────
  const {
    conversations,
    sidebarIdx,
    setSidebarIdx,
    messages,
    activeConv,
    loadingMsgs,
    streaming,
    streamPhase,
    activeTool,
    error,
    setError,
    sendMessage,
    removeConversation,
    renameActiveConversation,
    cancelStream,
  } = useConversations();

  // ── LLM info ──────────────────────────────────────────────────────
  const [llm, setLlm] = useState<LLMInfo | undefined>();
  const [loadingLLM, setLoadingLLM] = useState(false);

  const getCurrentLLM = useCallback(async () => {
    setLoadingLLM(true);
    try {
      const res = await getLLM();
      setLlm(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingLLM(false);
    }
  }, [setError]);

  useEffect(() => {
    getCurrentLLM();
  }, [getCurrentLLM]);

  // ── Command palette state ─────────────────────────────────────────
  const [input, setInput] = useState("");
  const [cmdIndex, setCmdIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ── Conversation search state ─────────────────────────────────────
  const [convSearchOpen, setConvSearchOpen] = useState(false);
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [convSearchIdx, setConvSearchIdx] = useState(0);

  // ── Scroll state ──────────────────────────────────────────────────
  const [scrollOffset, setScrollOffset] = useState(0);
  const prevMsgCount = React.useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length !== prevMsgCount.current) {
      prevMsgCount.current = messages.length;
      setScrollOffset(0);
    }
  }, [messages.length]);

  // Reset palette index when input changes
  useEffect(() => {
    setCmdIndex(0);
  }, [input]);

  const palette = filterCommands(input);
  const showPalette = palette.length > 0 && !streaming;

  // ── Execute slash command ─────────────────────────────────────────

  const executeCommand = useCallback(
    async (cmd: { trigger: string }, args: string) => {
      setInput("");
      setCmdIndex(0);
      setDeleteConfirm(false);

      switch (cmd.trigger) {
        case "/new":
          setSidebarIdx(-1);
          setScrollOffset(0);
          break;

        case "/conversation":
          setConvSearchOpen(true);
          setConvSearchQuery("");
          setConvSearchIdx(0);
          break;

        case "/provider": {
          const provider = args.trim();
          if (!provider) { setError("Usage: /provider <provider>"); break; }
          try {
            writeCredentials({ LLM_PROVIDER: provider });
            await getCurrentLLM();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          break;
        }

        case "/rename": {
          const newTitle = args.trim();
          if (!activeConv) { setError("No conversation selected."); break; }
          if (!newTitle) { setError("Usage: /rename My New Title"); break; }
          try { await renameActiveConversation(newTitle); }
          catch (e) { setError(e instanceof Error ? e.message : String(e)); }
          break;
        }

        case "/delete":
          if (!activeConv) { setError("No conversation selected."); break; }
          setDeleteConfirm(true);
          break;

        case "/menu":
          onNavigate("main-menu");
          break;

        case "/help":
          break; // help is rendered inline via COMMANDS list
      }
    },
    [activeConv, onNavigate, getCurrentLLM, renameActiveConversation, setError, setSidebarIdx],
  );

  // ── Submit handler ────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      if (deleteConfirm) {
        if (trimmed.toLowerCase() === "yes" || trimmed === "y") {
          if (activeConv) {
            removeConversation(activeConv.id).catch((e: unknown) =>
              setError(e instanceof Error ? e.message : String(e)),
            );
          }
        }
        setDeleteConfirm(false);
        setInput("");
        return;
      }

      if (showPalette) {
        const selected = palette[cmdIndex] ?? palette[0];
        if (selected) {
          const exact = matchExact(trimmed);
          if (exact) {
            executeCommand(exact, trimmed.slice(exact.trigger.length).trim());
          } else {
            executeCommand(selected, "");
          }
          return;
        }
      }

      setInput("");
      sendMessage(trimmed);
    },
    [
      deleteConfirm,
      showPalette,
      palette,
      cmdIndex,
      activeConv,
      executeCommand,
      sendMessage,
      removeConversation,
      setError,
    ],
  );

  // ── Keyboard handler ──────────────────────────────────────────────

  useInput((ch, key) => {
    // Conversation search modal
    if (convSearchOpen) {
      if (key.escape) { setConvSearchOpen(false); setConvSearchQuery(""); return; }
      const filtered = conversations.filter(
        (c) =>
          (c.title ?? "").toLowerCase().includes(convSearchQuery.toLowerCase()) ||
          c.id.startsWith(convSearchQuery),
      );
      if (key.upArrow) { setConvSearchIdx((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setConvSearchIdx((i) => Math.min(filtered.length - 1, i + 1)); return; }
      if (key.return) {
        const chosen = filtered[convSearchIdx];
        if (chosen) {
          const idx = conversations.indexOf(chosen);
          setSidebarIdx(idx);
          setScrollOffset(0);
        }
        setConvSearchOpen(false);
        setConvSearchQuery("");
        return;
      }
      if (key.backspace || key.delete) { setConvSearchQuery((q) => q.slice(0, -1)); setConvSearchIdx(0); return; }
      if (ch && !key.ctrl && !key.meta && ch.length === 1) { setConvSearchQuery((q) => q + ch); setConvSearchIdx(0); return; }
      return;
    }

    // Command palette arrow navigation
    if (showPalette) {
      if (key.upArrow) { setCmdIndex((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setCmdIndex((i) => Math.min(palette.length - 1, i + 1)); return; }
      if (key.escape) { setInput(""); setCmdIndex(0); return; }
    }

    // Delete confirm cancel
    if (deleteConfirm && key.escape) { setDeleteConfirm(false); setInput(""); return; }

    // Scroll
    if (!showPalette && !deleteConfirm) {
      if (key.upArrow && key.ctrl) { setScrollOffset((o) => o + 3); return; }
      if (key.downArrow && key.ctrl) { setScrollOffset((o) => Math.max(0, o - 3)); return; }
      if (key.pageUp) { setScrollOffset((o) => o + 10); return; }
      if (key.pageDown) { setScrollOffset((o) => Math.max(0, o - 10)); return; }
    }

    // Cancel streaming
    if (key.ctrl && ch === "c" && streaming) { cancelStream(); }
  });

  // ── Layout math ───────────────────────────────────────────────────

  const INPUT_HEIGHT = 6;
  const PALETTE_HEIGHT = showPalette ? Math.min(palette.length + 2, 8) : 0;
  const ERROR_HEIGHT = error ? 1 : 0;
  const MSG_AREA_HEIGHT = Math.max(
    4,
    rows - INPUT_HEIGHT - PALETTE_HEIGHT - ERROR_HEIGHT - 2,
  );
  const MAX_SEARCH_VISIBLE = Math.min(8, rows - 10);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Box flexDirection="column" height={rows} overflow="hidden">
      <Box flexDirection="row" flexGrow={1} overflow="hidden">
        <Box flexDirection="column" flexGrow={1}>
          {/* Messages / home screen */}
          <MessageList
            messages={messages}
            streamPhase={streamPhase}
            activeTool={activeTool}
            scrollOffset={scrollOffset}
            height={MSG_AREA_HEIGHT}
            width={MSG_WIDTH}
          />

          {/* Conversation search modal */}
          {convSearchOpen && (
            <ConvSearchModal
              conversations={conversations}
              query={convSearchQuery}
              selectedIdx={convSearchIdx}
              maxVisible={MAX_SEARCH_VISIBLE}
            />
          )}

          {/* Error */}
          {error && (
            <Box paddingX={2}>
              <Text color="red" dimColor>
                ⚠ {error}
              </Text>
            </Box>
          )}

          {/* Command palette / delete confirm */}
          <CommandPalette
            palette={palette}
            cmdIndex={cmdIndex}
            deleteConfirm={deleteConfirm}
            activeConvTitle={
              activeConv ? shortTitle(activeConv.title, activeConv.id) : ""
            }
          />

          {/* Input */}
          <ChatInput
            input={input}
            onChange={(val) => {
              setInput(val);
              if (deleteConfirm && !val) setDeleteConfirm(false);
            }}
            onSubmit={handleSubmit}
            streaming={streaming}
            streamPhase={streamPhase}
            activeTool={activeTool}
            showPalette={showPalette}
            deleteConfirm={deleteConfirm}
            llm={llm}
            loadingLLM={loadingLLM}
          />
        </Box>
      </Box>
    </Box>
  );
}
