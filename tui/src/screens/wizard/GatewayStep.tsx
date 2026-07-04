import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";

import { MenuSelect } from "../../components/MenuSelect.js";
import { Footer } from "../../components/Footer.js";
import {
  GatewayConfigurator,
  type GatewayPlatform,
} from "../../components/GatewayConfigurator.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GATEWAY_ITEMS = [
  { label: "📨  Telegram", value: "telegram" },
  { label: "🎮  Discord", value: "discord" },
  { label: "⏭  Skip for now", value: "skip" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GatewayStepProps {
  authToken: string;
  baseUrl: string;
  onDone: () => void;
}

export function GatewayStep({ authToken, baseUrl, onDone }: GatewayStepProps) {
  type GatewaySubStep = "pick" | "configure";
  const [subStep, setSubStep] = useState<GatewaySubStep>("pick");
  const [selectedGateway, setSelectedGateway] =
    useState<GatewayPlatform | null>(null);

  // Esc inside "configure" goes back to "pick"
  useInput((_input, key) => {
    if (key.escape && subStep === "configure") {
      setSubStep("pick");
      setSelectedGateway(null);
    }
  });

  const handleGatewaySelect = useCallback(
    (item: { value: string }) => {
      if (item.value === "skip") { onDone(); return; }
      setSelectedGateway(item.value as GatewayPlatform);
      setSubStep("configure");
    },
    [onDone],
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>Gateway Configuration</Text>
      <Text color="gray" dimColor>
        Connect a messaging platform so your agent can receive messages.
      </Text>

      {subStep === "pick" && (
        <>
          <Text color="gray" dimColor>Select a gateway to configure:</Text>
          <MenuSelect items={GATEWAY_ITEMS} onSelect={handleGatewaySelect} />
          <Footer
            hints={[
              { key: "↑↓", label: "navigate" },
              { key: "Enter", label: "select" },
              { key: "Esc", label: "back" },
            ]}
          />
        </>
      )}

      {subStep === "configure" && selectedGateway && (
        <GatewayConfigurator
          gateway={selectedGateway}
          authToken={authToken}
          baseUrl={baseUrl}
          onDone={onDone}
          onBack={() => {
            setSubStep("pick");
            setSelectedGateway(null);
          }}
        />
      )}
    </Box>
  );
}
