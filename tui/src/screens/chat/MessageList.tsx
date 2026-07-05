import React from "react";
import { Box, Text } from "ink";
import { Logo } from "../../components/Logo.js";
import type { LocalMessage } from "../../hooks/useConversations.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageListProps {
  messages: LocalMessage[];
  streamPhase: string;
  activeTool: string;
  scrollOffset: number;
  height: number;
  width: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageList({
  messages,
  streamPhase,
  activeTool,
  scrollOffset,
  height,
  width,
}: MessageListProps) {
  // Home screen when there are no messages
  if (messages.length === 0) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flexGrow={1}
        gap={1}
      >
        <Box flexDirection="column" marginBottom={2} alignItems="center">
          <Logo color="gray" subtitle="v1.0.0" />
        </Box>
      </Box>
    );
  }

  const MSG_WIDTH = width - 6;

  // Build a flat list of displayable lines
  const allLines: Array<{ color: string; text: string; bold?: boolean }> = [];
  for (const msg of messages) {
    const isUser = msg.role === "user";
    const label = isUser
      ? "You"
      : msg.streaming
        ? `◌ Nexus [${activeTool ? `using ${activeTool}` : streamPhase}]`
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
  const maxOffset = Math.max(0, allLines.length - height);
  const clampedOffset = Math.min(scrollOffset, maxOffset);
  const startIdx = Math.max(0, allLines.length - height - clampedOffset);
  const visible = allLines.slice(startIdx, startIdx + height);

  const atBottom = clampedOffset === 0;
  const atTop = clampedOffset >= maxOffset;

  return (
    <Box flexDirection="column" height={height} overflow="hidden" paddingX={1}>
      {!atTop && allLines.length > height && (
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
}
