import React, { useState, useCallback } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

import { SpinnerRow } from "../../components/SpinnerRow.js";
import { readConfig, readCredentials, writeCredentials } from "../../config.js";
import { disableGateway } from "../../api/client.js";
import type { Integration } from "../../api/types.js";

interface DisconnectConfirmProps {
  integration: Integration;
  onDisconnected: (integration: Integration) => void;
  onCancel: () => void;
}

export function DisconnectConfirm({
  integration,
  onDisconnected,
  onCancel,
}: DisconnectConfirmProps) {
  const [saving, setSaving] = useState(false);

  const handleSelect = useCallback(
    async (item: { value: string }) => {
      if (item.value !== "yes") {
        onCancel();
        return;
      }
      setSaving(true);
      try {
        const isGateway = integration.category === "Gateways";
        const cfg = readConfig();

        if (isGateway) {
          await disableGateway(
            integration.name,
            cfg.token ?? "",
            cfg.baseUrl ?? "http://localhost:8421",
          );
        } else {
          const creds = readCredentials();
          const enabled = creds.ENABLED_INTEGRATIONS || [];
          writeCredentials({
            ENABLED_INTEGRATIONS: enabled.filter(
              (name) => name !== integration.name,
            ),
          });
        }
        onDisconnected(integration);
      } finally {
        setSaving(false);
      }
    },
    [integration, onDisconnected, onCancel],
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>
        Disconnect: {integration.displayName}
      </Text>
      {integration.connectedAt && (
        <Text color="gray" dimColor>
          Connected since {new Date(integration.connectedAt).toLocaleString()}
        </Text>
      )}
      <Text color="yellow">⚠ Are you sure you want to disconnect?</Text>
      {saving ? (
        <SpinnerRow label="Disconnecting…" />
      ) : (
        <SelectInput
          items={[
            { label: "Yes, disconnect", value: "yes" },
            { label: "Cancel", value: "no" },
          ]}
          onSelect={handleSelect}
          indicatorComponent={({ isSelected }) => (
            <Text color={isSelected ? "red" : "gray"}>
              {isSelected ? "▶ " : "  "}
            </Text>
          )}
          itemComponent={({ isSelected, label }) => (
            <Text
              color={
                isSelected
                  ? label.startsWith("Yes")
                    ? "red"
                    : "cyan"
                  : "white"
              }>
              {label}
            </Text>
          )}
        />
      )}
    </Box>
  );
}
