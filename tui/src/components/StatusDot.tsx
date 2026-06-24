import React from 'react';
import { Text } from 'ink';

interface StatusDotProps {
  connected: boolean;
  label?: string;
}

export function StatusDot({ connected, label }: StatusDotProps) {
  return (
    <Text>
      <Text color={connected ? 'green' : 'red'}>●</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  );
}
