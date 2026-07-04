import React from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import type { Screen } from "../api/types.js";
import { Footer } from "../components/Footer.js";
import { Logo } from "../components/Logo.js";

const MENU_ITEMS = [
  // { label: "Chat", value: "chat" as Screen },
  { label: "Config Editor", value: "config-editor" as Screen },
  { label: "Gateways & Integrations", value: "integrations" as Screen },
];

interface MainMenuProps {
  onNavigate: (screen: Screen) => void;
  onBackToChat: () => void;
  hasConfig: boolean;
}

export function MainMenu({
  onNavigate,
  onBackToChat,
  hasConfig,
}: MainMenuProps) {
  useInput((input, key) => {
    if (key.escape || input === "q") {
      if (hasConfig) onBackToChat();
      else process.exit(0);
    }
  });

  const handleSelect = (item: { value: Screen }) => {
    onNavigate(item.value);
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* Logo */}
      <Box flexDirection="column" marginBottom={2} alignItems="center">
        <Logo color="cyan" subtitle="Self-hosted Personal AI Agent" />
      </Box>

      {/* Menu */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>
          ─────────────────────────────────────
        </Text>
        <SelectInput
          items={MENU_ITEMS}
          onSelect={handleSelect}
          indicatorComponent={({ isSelected }) => (
            <Text color="cyan">{isSelected ? "▶ " : "  "}</Text>
          )}
          itemComponent={({ isSelected, label }) => (
            <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
              {label}
            </Text>
          )}
        />
        <Text color="gray" dimColor>
          ─────────────────────────────────────
        </Text>
      </Box>

      <Box flexGrow={1} />

      <Footer
        hints={[
          { key: "↑↓", label: "navigate" },
          { key: "Enter", label: "select" },
          { key: "Esc / q", label: "back to chat" },
        ]}
      />
    </Box>
  );
}
