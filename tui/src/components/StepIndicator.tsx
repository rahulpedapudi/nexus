import React from 'react';
import { Box, Text } from 'ink';

interface StepIndicatorProps {
  current: number;
  total: number;
  label?: string;
}

export function StepIndicator({ current, total, label }: StepIndicatorProps) {
  return (
    <Box gap={2} marginBottom={1}>
      <Box gap={1}>
        {Array.from({ length: total }).map((_, i) => (
          <Text
            key={i}
            color={i < current ? 'green' : i === current ? 'cyan' : 'gray'}
            bold={i === current}
          >
            {i < current ? '●' : i === current ? '◉' : '○'}
          </Text>
        ))}
      </Box>
      <Text color="gray" dimColor>
        Step {current + 1} of {total}
        {label ? ` — ${label}` : ''}
      </Text>
    </Box>
  );
}
