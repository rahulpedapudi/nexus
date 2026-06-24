import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";

import { StatusDot } from "../components/StatusDot.js";
import { Footer } from "../components/Footer.js";
import { readConfig } from "../config.js";
import type { Integration } from "../api/types.js";

// ---------------------------------------------------------------------------
// Static integration catalogue
// ---------------------------------------------------------------------------

const INTEGRATION_CATALOGUE: Integration[] = [
  {
    name: "groq",
    displayName: "Groq (LLM)",
    connected: false,
    fields: [
      {
        key: "api_key",
        label: "Groq API Key",
        placeholder: "gsk_…",
        masked: true,
      },
    ],
  },
  {
    name: "openrouter",
    displayName: "OpenRouter (LLM)",
    connected: false,
    fields: [
      {
        key: "api_key",
        label: "OpenRouter API Key",
        placeholder: "sk-or-…",
        masked: true,
      },
    ],
  },
  {
    name: "google",
    displayName: "Google Calendar",
    connected: false,
    fields: [
      {
        key: "client_id",
        label: "OAuth Client ID",
        placeholder: "*.apps.googleusercontent.com",
        masked: false,
      },
      {
        key: "client_secret",
        label: "OAuth Client Secret",
        placeholder: "••••••",
        masked: true,
      },
    ],
  },
  {
    name: "telegram",
    displayName: "Telegram Bot",
    connected: false,
    fields: [
      {
        key: "bot_token",
        label: "Bot Token",
        placeholder: "1234567890:ABC…",
        masked: true,
      },
    ],
  },
  {
    name: "discord",
    displayName: "Discord Bot",
    connected: false,
    fields: [
      {
        key: "bot_token",
        label: "Bot Token",
        placeholder: "MTI…",
        masked: true,
      },
    ],
  },
];

interface IntegrationsProps {
  onBack: () => void;
}

type SubScreen = "list" | "connect" | "disconnect";

// ---------------------------------------------------------------------------

export function Integrations({ onBack }: IntegrationsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(
    INTEGRATION_CATALOGUE,
  );
  const [loading, setLoading] = useState(true);

  const [subScreen, setSubScreen] = useState<SubScreen>("list");
  const [selected, setSelected] = useState<Integration | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Load connected status by checking /keys/list
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const cfg = readConfig();
        const res = await fetch(
          `${cfg.baseUrl ?? "http://localhost:8000"}/keys/list`,
          {
            headers: { Authorization: `Bearer ${cfg.token ?? ""}` },
          },
        );
        if (res.ok) {
          const keys: Array<{ provider: string }> = await res.json();
          if (keys.length > 0)
            setIntegrations((prev) =>
              prev.map((intg) => {
                const k = keys.find(
                  (kk) => kk.provider.toLowerCase() === intg.name.toLowerCase(),
                );
                return k ? { ...intg, connected: true } : intg;
              }),
            );
        }
      } catch {
        // offline — show defaults
      } finally {
        setLoading(false);
      }
    };
    loadStatuses();
  }, []);

  // -------------------------------------------------------------------
  // Global key handler
  // -------------------------------------------------------------------

  useInput((input, key) => {
    if (key.escape || input === "q") {
      if (subScreen !== "list") {
        setSubScreen("list");
        setSaveError("");
        setSaveSuccess("");
      } else {
        onBack();
      }
    }
  });

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

  const openConnect = useCallback((intg: Integration) => {
    setSelected(intg);
    setFieldValues(Object.fromEntries(intg.fields.map((f) => [f.key, ""])));
    setFocusedField(0);
    setSaveError("");
    setSaveSuccess("");
    setSubScreen("connect");
  }, []);

  const openDisconnect = useCallback((intg: Integration) => {
    setSelected(intg);
    setSaveError("");
    setSubScreen("disconnect");
  }, []);

  const handleFieldSubmit = useCallback(() => {
    if (!selected) return;
    if (focusedField < selected.fields.length - 1) {
      setFocusedField((f) => f + 1);
    } else {
      handleSave();
    }
  }, [focusedField, selected]);

  const handleSave = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError("");
    try {
      const cfg = readConfig();
      const firstValue = Object.values(fieldValues)[0] ?? "";
      const res = await fetch(
        `${cfg.baseUrl ?? "http://localhost:8000"}/keys/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.token ?? ""}`,
          },
          body: JSON.stringify({ provider: selected.name, key: firstValue }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      setIntegrations((prev) =>
        prev.map((i) =>
          i.name === selected.name
            ? { ...i, connected: true, connectedAt: new Date().toISOString() }
            : i,
        ),
      );
      setSaveSuccess(`✓  ${selected.displayName} connected!`);
      setTimeout(() => setSubScreen("list"), 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [selected, fieldValues]);

  const handleDisconnect = useCallback(
    async (item: { value: string }) => {
      if (item.value !== "yes" || !selected) {
        setSubScreen("list");
        return;
      }
      setSaving(true);
      try {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.name === selected.name
              ? { ...i, connected: false, connectedAt: undefined }
              : i,
          ),
        );
      } finally {
        setSaving(false);
        setSubScreen("list");
      }
    },
    [selected],
  );

  // -------------------------------------------------------------------
  // Sub-screens
  // -------------------------------------------------------------------

  const renderList = () => {
    if (loading) {
      return (
        <Box gap={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="cyan">Loading integrations…</Text>
        </Box>
      );
    }

    const items = integrations.map((intg) => ({
      label: intg.displayName,
      value: intg.name,
    }));

    return (
      <Box flexDirection="column">
        <SelectInput
          items={items}
          onSelect={(item) => {
            const intg = integrations.find((i) => i.name === item.value)!;
            if (intg.connected) openDisconnect(intg);
            else openConnect(intg);
          }}
          indicatorComponent={({ isSelected }) => (
            <Text color="cyan">{isSelected ? "▶ " : "  "}</Text>
          )}
          itemComponent={({ isSelected, label }) => {
            const intg = integrations.find((i) => i.displayName === label)!;
            return (
              <Box gap={2}>
                <StatusDot connected={intg?.connected ?? false} />
                <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
                  {label.padEnd(22)}
                </Text>
                <Text
                  color={intg?.connected ? "green" : "gray"}
                  dimColor={!intg?.connected}>
                  {(intg?.connected ? "connected" : "not set up").padEnd(12)}
                </Text>
                <Text color="cyan" dimColor>
                  {intg?.connected ? "[Disconnect]" : "[Connect]"}
                </Text>
              </Box>
            );
          }}
        />
      </Box>
    );
  };

  const renderConnect = () => {
    if (!selected) return null;
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="white" bold>
          Connect: {selected.displayName}
        </Text>
        <Text color="gray" dimColor>
          Enter the required credentials:
        </Text>

        {selected.fields.map((field, idx) => (
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

        {saving && (
          <Box gap={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text color="cyan">Connecting…</Text>
          </Box>
        )}
        {saveError && <Text color="red">✗ {saveError}</Text>}
        {saveSuccess && <Text color="green">{saveSuccess}</Text>}
      </Box>
    );
  };

  const renderDisconnect = () => {
    if (!selected) return null;
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="white" bold>
          Disconnect: {selected.displayName}
        </Text>
        {selected.connectedAt && (
          <Text color="gray" dimColor>
            Connected since {new Date(selected.connectedAt).toLocaleString()}
          </Text>
        )}
        <Text color="yellow">⚠ Are you sure you want to disconnect?</Text>
        {saving ? (
          <Box gap={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text color="cyan">Disconnecting…</Text>
          </Box>
        ) : (
          <SelectInput
            items={[
              { label: "Yes, disconnect", value: "yes" },
              { label: "Cancel", value: "no" },
            ]}
            onSelect={handleDisconnect}
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
  };

  // -------------------------------------------------------------------

  const SUB_RENDERERS: Record<SubScreen, () => React.ReactNode> = {
    list: renderList,
    connect: renderConnect,
    disconnect: renderDisconnect,
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="cyan" bold>
        🔗 Integrations
      </Text>

      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
        marginTop={1}
        flexDirection="column">
        {SUB_RENDERERS[subScreen]()}
      </Box>

      <Footer
        hints={
          subScreen === "list"
            ? [
                { key: "↑↓", label: "navigate" },
                { key: "Enter", label: "open" },
                { key: "q / Esc", label: "back" },
              ]
            : [
                {
                  key: "Enter",
                  label: subScreen === "connect" ? "next / save" : "select",
                },
                { key: "Esc", label: "back to list" },
              ]
        }
      />
    </Box>
  );
}
