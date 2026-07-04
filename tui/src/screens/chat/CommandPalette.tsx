import React from "react";
import { Box, Text } from "ink";
import type { SlashCommand } from "./types.js";

interface CommandPaletteProps {
  /** Filtered list of commands matching current input */
  palette: SlashCommand[];
  /** Index of the highlighted command */
  cmdIndex: number;
  /** Whether the delete-confirm box should be shown instead */
  deleteConfirm: boolean;
  /** Title of the currently active conversation (for delete prompt) */
  activeConvTitle: string;
}

export function CommandPalette({
  palette,
  cmdIndex,
  deleteConfirm,
  activeConvTitle,
}: CommandPaletteProps) {
  if (deleteConfirm) {
    return (
      <Box
        flexDirection="column"
        marginX={1}
        borderStyle="round"
        borderColor="red"
        paddingX={1}
      >
        <Text color="red" bold>
          ⚠ Delete "{activeConvTitle}"?
        </Text>
        <Text color="gray" dimColor>
          Type <Text color="yellow">yes</Text> and press Enter to confirm, or
          Esc to cancel.
        </Text>
      </Box>
    );
  }

  if (palette.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      marginX={1}
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      {palette.map((cmd, i) => {
        const isHighlighted = i === cmdIndex;
        return (
          <Box key={cmd.trigger} gap={2}>
            <Text color={isHighlighted ? "cyan" : "gray"} bold={isHighlighted}>
              {isHighlighted ? "▶ " : "  "}
              {cmd.trigger.padEnd(10)}
            </Text>
            <Text
              color={isHighlighted ? "white" : "gray"}
              dimColor={!isHighlighted}
            >
              {cmd.description}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
