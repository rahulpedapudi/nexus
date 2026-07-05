import React, { useState, useCallback } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { SpinnerRow } from "../../components/SpinnerRow.js";
import { readConfig } from "../../config.js";
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

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      const cfg = readConfig();
      const firstValue = Object.values(fieldValues)[0] ?? "";
      const res = await fetch(
        `${cfg.baseUrl ?? "http://localhost:8421"}/keys/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.token ?? ""}`,
          },
          body: JSON.stringify({ provider: integration.name, key: firstValue }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
        );
      }
      setSaveSuccess(`✓  ${integration.displayName} connected!`);
      setTimeout(() => onDone(integration), 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [integration, fieldValues, onDone]);

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
      <Text color="gray" dimColor>
        Enter the required credentials:
      </Text>

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
