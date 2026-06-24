import React from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../api/types.js';

interface LogLineProps {
  entry: LogEntry;
}

const LEVEL_COLORS: Record<string, string> = {
  INFO: 'white',
  WARN: 'yellow',
  ERROR: 'red',
  DEBUG: 'gray',
};

export function LogLine({ entry }: LogLineProps) {
  const color = LEVEL_COLORS[entry.level] ?? 'white';
  const ts = new Date(entry.timestamp);
  const timeStr = isNaN(ts.getTime())
    ? entry.timestamp.slice(0, 19)
    : ts.toLocaleTimeString('en-US', { hour12: false });

  return (
    <Box gap={1}>
      <Text color="gray" dimColor>
        {timeStr}
      </Text>
      <Text color={color} bold={entry.level === 'ERROR'}>
        {entry.level.padEnd(5)}
      </Text>
      <Text color={color} wrap="truncate-end">
        {entry.message}
      </Text>
    </Box>
  );
}
