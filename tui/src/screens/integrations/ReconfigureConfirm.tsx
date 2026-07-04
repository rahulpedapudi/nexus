import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

import { Footer } from "../../components/Footer.js";
import type { Integration } from "../../api/types.js";

interface ReconfigureConfirmProps {
  integration: Integration;
  onReconfigure: () => void;
  onDisconnect: () => void;
  onCancel: () => void;
}

const PLATFORM_META: Record<
  string,
  { name: string; icon: string; reconfigureHint: string }
> = {
  telegram: {
    name: "Telegram",
    icon: "📨",
    reconfigureHint: "You will need to re-link your bot with a new token.",
  },
  discord: {
    name: "Discord",
    icon: "🎮",
    reconfigureHint: "You will need to re-link your bot with a new token.",
  },
  google: {
    name: "Google Calendar",
    icon: "📅",
    reconfigureHint:
      "You will need to re-authenticate with your Google account.",
  },
};

export function ReconfigureConfirm({
  integration,
  onReconfigure,
  onDisconnect,
  onCancel,
}: ReconfigureConfirmProps) {
  const meta = PLATFORM_META[integration.name] ?? {
    name: integration.displayName,
    icon: "🔗",
    reconfigureHint: "You will need to reconfigure this integration.",
  };

  const handleSelect = (item: { value: string }) => {
    if (item.value === "yes") onReconfigure();
    else if (item.value === "disconnect") onDisconnect();
    else onCancel();
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>
        {meta.icon} Reconfigure {meta.name}
      </Text>
      <Text color="gray" dimColor>
        {meta.name} is already connected.
      </Text>
      <Text color="yellow">⚠ Are you sure you want to reconfigure it?</Text>
      <Text color="gray" dimColor>
        {meta.reconfigureHint}
      </Text>
      <SelectInput
        items={[
          { label: "Yes, reconfigure", value: "yes" },
          { label: "Disconnect", value: "disconnect" },
          { label: "Cancel", value: "no" },
        ]}
        onSelect={handleSelect}
        indicatorComponent={({ isSelected }) => (
          <Text color={isSelected ? "yellow" : "gray"}>
            {isSelected ? "▶ " : "  "}
          </Text>
        )}
        itemComponent={({ isSelected, label }) => (
          <Text
            color={
              isSelected
                ? label.startsWith("Yes")
                  ? "yellow"
                  : "cyan"
                : "white"
            }
          >
            {label}
          </Text>
        )}
      />
      <Footer
        hints={[
          { key: "↑↓", label: "navigate" },
          { key: "Enter", label: "select" },
          { key: "Esc", label: "cancel" },
        ]}
      />
    </Box>
  );
}
