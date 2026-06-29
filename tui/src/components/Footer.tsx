import React from "react";
import { Box, Text } from "ink";

interface FooterProps {
  hints: Array<{ key: string; label: string }>;
}

export function Footer({ hints }: FooterProps) {
  return (
    <Box
      paddingX={1}
      flexDirection="row"
      flexWrap="wrap"
      gap={2}
      marginTop={1}>
      {hints.map(({ key, label }, i) => (
        <Box key={i} gap={1}>
          <Text color="cyan" bold>
            [
          </Text>
          <Text color="cyan" bold>
            {key}
          </Text>
          <Text color="cyan" bold>
            ]
          </Text>
          <Text color="gray">{label}</Text>
        </Box>
      ))}
    </Box>
  );
}
