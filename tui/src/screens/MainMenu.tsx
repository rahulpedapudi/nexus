import React from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import type { Screen } from "../api/types.js";
import { Footer } from "../components/Footer.js";

const NEXUS_LOGO = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`.trim();

const MENU_ITEMS = [
  { label: "💬  Chat", value: "chat" as Screen },
  { label: "⚡  Setup Wizard", value: "setup-wizard" as Screen },
  { label: "📊  Dashboard", value: "dashboard" as Screen },
  { label: "🔗  Integrations", value: "integrations" as Screen },
  { label: "⚙️   Config Editor", value: "config-editor" as Screen },
];

interface MainMenuProps {
  onNavigate: (screen: Screen) => void;
  onBackToChat: () => void;
  hasConfig: boolean;
}

export function MainMenu({ onNavigate, onBackToChat, hasConfig }: MainMenuProps) {
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
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Logo */}
      <Box flexDirection="column" marginBottom={2} alignItems="center">
        {NEXUS_LOGO.split("\n").map((line, i) => (
          <Text key={i} color="cyan" bold>
            {line}
          </Text>
        ))}
        <Text color="gray" dimColor>
          Self-hosted Personal AI Agent
        </Text>
      </Box>

      {/* Status badge */}
      {!hasConfig && (
        <Box
          borderStyle="round"
          borderColor="yellow"
          paddingX={2}
          paddingY={0}
          marginBottom={1}
          alignSelf="flex-start"
        >
          <Text color="yellow">⚠  Not configured — run Setup Wizard first</Text>
        </Box>
      )}
      {hasConfig && (
        <Box
          borderStyle="round"
          borderColor="green"
          paddingX={2}
          paddingY={0}
          marginBottom={1}
          alignSelf="flex-start"
        >
          <Text color="green">✓  Configured and ready</Text>
        </Box>
      )}

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

      <Footer
        hints={[
          { key: "↑↓", label: "navigate" },
          { key: "Enter", label: "select" },
          { key: "Esc / q", label: hasConfig ? "back to chat" : "quit" },
        ]}
      />
    </Box>
  );
}
