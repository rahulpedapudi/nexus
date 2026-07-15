import React, { useState, useCallback } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { SpinnerRow } from "../../components/SpinnerRow.js";
import { readCredentials, writeCredentials } from "../../config.js";
import type { Integration } from "../../api/types.js";

interface ConnectFormProps {
  integration: Integration;
  onDone: (integration: Integration) => void;
  onBack: () => void;
}

export function ConnectForm({ integration, onDone, onBack }: ConnectFormProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    Object.fromEntries(integration.fields.map((f) => [f.key, ""])),
  );
  const [focusedField, setFocusedField] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [token, setToken] = useState("");

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      const existing = readCredentials();
      const alreadyEnabled = existing.ENABLED_INTEGRATIONS ?? [];
      const enabledIntegrations = alreadyEnabled.includes(integration.name)
        ? alreadyEnabled
        : [...alreadyEnabled, integration.name];

      writeCredentials({
        [integration.name]: { token },
        ENABLED_INTEGRATIONS: enabledIntegrations,
      });

      setSaveSuccess(`✓  ${integration.displayName} connected!`);
      setTimeout(() => onDone(integration), 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [integration, onDone, token]);

  const handleFieldSubmit = useCallback(() => {
    if (focusedField < integration.fields.length - 1) {
      setFocusedField((f) => f + 1);
    } else {
      handleSave();
    }
  }, [focusedField, integration.fields.length, handleSave]);

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>
        Connect: {integration.displayName}
      </Text>
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <TextInput
          focus={true}
          value={token}
          onChange={setToken}
          onSubmit={handleSave}
          placeholder="Enter your Personal API Key"
        />
      </Box>

      {integration.fields.map((field, idx) => (
        <Box key={field.key} flexDirection="column" gap={0}>
          <Text color={idx === focusedField ? "cyan" : "gray"}>
            {field.label}
          </Text>
          <Box
            borderStyle="round"
            borderColor={idx === focusedField ? "cyan" : "gray"}
            paddingX={1}>
            <TextInput
              value={fieldValues[field.key] ?? ""}
              onChange={(val) =>
                setFieldValues((prev) => ({ ...prev, [field.key]: val }))
              }
              onSubmit={handleFieldSubmit}
              focus={idx === focusedField}
              mask={field.masked ? "*" : undefined}
              placeholder={field.placeholder}
            />
          </Box>
        </Box>
      ))}

      {saving && <SpinnerRow label="Connecting…" />}
      {saveError && <Text color="red">✗ {saveError}</Text>}
      {saveSuccess && <Text color="green">{saveSuccess}</Text>}
    </Box>
  );
}
