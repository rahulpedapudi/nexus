import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

interface SpinnerRowProps {
  label: string;
  color?: string;
}

/** A horizontally-laid-out spinner + label. Used for loading states. */
export function SpinnerRow({ label, color = "cyan" }: SpinnerRowProps) {
  return (
    <Box gap={1}>
      <Text color={color}>
        <Spinner type="dots" />
      </Text>
      <Text color={color}>{label}</Text>
    </Box>
  );
}
