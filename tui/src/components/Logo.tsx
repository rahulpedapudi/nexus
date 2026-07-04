import React from "react";
import { Box, Text } from "ink";

const NEXUS_LOGO = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`.trim();

interface LogoProps {
  /** Color for the logo lines. Defaults to "cyan". */
  color?: string;
  /** Optional subtitle rendered below the logo. */
  subtitle?: string;
}

export function Logo({ color = "cyan", subtitle }: LogoProps) {
  return (
    <Box flexDirection="column" alignItems="center">
      {NEXUS_LOGO.split("\n").map((line, i) => (
        <Text key={i} color={color} bold>
          {line}
        </Text>
      ))}
      {subtitle && (
        <Text color="gray" dimColor>
          {subtitle}
        </Text>
      )}
    </Box>
  );
}
