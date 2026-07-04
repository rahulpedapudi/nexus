import React from "react";
import { Box, Text } from "ink";
import type { ConversationResponse } from "../../api/types.js";

function shortTitle(t: string | null, id: string): string {
  if (!t) return `conv-${id.slice(0, 6)}`;
  return t.length > 22 ? t.slice(0, 21) + "…" : t;
}

interface ConvSearchModalProps {
  conversations: ConversationResponse[];
  query: string;
  selectedIdx: number;
  maxVisible: number;
}

export function ConvSearchModal({
  conversations,
  query,
  selectedIdx,
  maxVisible,
}: ConvSearchModalProps) {
  const filtered = conversations.filter(
    (c) =>
      (c.title ?? "").toLowerCase().includes(query.toLowerCase()) ||
      c.id.startsWith(query),
  );

  const startI = Math.max(0, selectedIdx - maxVisible + 1);
  const visible = filtered.slice(startI, startI + maxVisible);

  return (
    <Box
      flexDirection="column"
      marginX={2}
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      <Box gap={1} marginBottom={1}>
        <Text color="cyan" bold>
          🔍
        </Text>
        <Text color="cyan" bold>
          {query || " "}
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
          const isSelected = realIdx === selectedIdx;
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
}
