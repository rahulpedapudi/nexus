import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";

import { Footer } from "../components/Footer.js";
import { readConfig, readCredentials } from "../config.js";
import type { Integration } from "../api/types.js";
import {
  GatewayConfigurator,
  type GatewayPlatform,
} from "../components/GatewayConfigurator.js";

import { IntegrationList } from "./integrations/IntegrationList.js";
import { ConnectForm } from "./integrations/ConnectForm.js";
import { DisconnectConfirm } from "./integrations/DisconnectConfirm.js";
import { ReconfigureConfirm } from "./integrations/ReconfigureConfirm.js";
import { GoogleOAuthScreen } from "./integrations/GoogleOAuthScreen.js";

// ---------------------------------------------------------------------------
// Static integration catalogue
// ---------------------------------------------------------------------------

const INTEGRATION_CATALOGUE: Integration[] = [
  {
    name: "telegram",
    category: "Gateways",
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
    category: "Gateways",
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
  {
    name: "google",
    category: "Integrations",
    displayName: "Google Calendar",
    connected: false,
    fields: [],
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubScreen =
  | "list"
  | "connect"
  | "disconnect"
  | "gateway"
  | "reconfigure"
  | "google-oauth";

interface IntegrationsProps {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Integrations({ onBack }: IntegrationsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(
    INTEGRATION_CATALOGUE,
  );
  const [loading, setLoading] = useState(true);
  const [subScreen, setSubScreen] = useState<SubScreen>("list");
  const [selected, setSelected] = useState<Integration | null>(null);
  const [gatewayTarget, setGatewayTarget] = useState<GatewayPlatform | null>(
    null,
  );
  const [authToken, setAuthToken] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:8000");

  // ── Load connection statuses ──────────────────────────────────────

  const loadStatuses = useCallback(async () => {
    try {
      const cfg = readConfig();
      setAuthToken(cfg.token ?? "");
      setApiBaseUrl(cfg.baseUrl ?? "http://localhost:8000");

      const creds = readCredentials();
      const enabled = [
        ...(creds.ENABLED_GATEWAYS ?? []),
        ...(creds.ENABLED_INTEGRATIONS ?? []),
      ];

      if (enabled.length > 0) {
        setIntegrations((prev) =>
          prev.map((intg) =>
            enabled.includes(intg.name) ? { ...intg, connected: true } : intg,
          ),
        );
      }
    } catch {
      // offline — show defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  // ── Navigation helpers ────────────────────────────────────────────

  const goList = useCallback(() => {
    setSubScreen("list");
    setSelected(null);
    setGatewayTarget(null);
  }, []);

  // ── Global keyboard handler ───────────────────────────────────────

  useInput((input, key) => {
    if (key.escape || input === "q") {
      if (subScreen !== "list") goList();
      else onBack();
    }
  });

  // ── Select an integration from the list ───────────────────────────

  const handleSelect = useCallback((intg: Integration) => {
    setSelected(intg);
    if (intg.connected) {
      setSubScreen("reconfigure");
    } else if (intg.name === "telegram" || intg.name === "discord") {
      setGatewayTarget(intg.name as GatewayPlatform);
      setSubScreen("gateway");
    } else if (intg.name === "google") {
      setSubScreen("google-oauth");
    } else {
      setSubScreen("connect");
    }
  }, []);

  // ── Mark an integration connected ─────────────────────────────────

  const markConnected = useCallback((intg: Integration) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.name === intg.name
          ? { ...i, connected: true, connectedAt: new Date().toISOString() }
          : i,
      ),
    );
  }, []);

  // ── Mark an integration disconnected ──────────────────────────────

  const markDisconnected = useCallback((intg: Integration) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.name === intg.name ? { ...i, connected: false } : i)),
    );
    goList();
  }, [goList]);

  // ── Footer hints per sub-screen ───────────────────────────────────

  const footerHints = () => {
    switch (subScreen) {
      case "list":
        return [
          { key: "↑↓", label: "navigate" },
          { key: "Enter", label: "open" },
          { key: "q / Esc", label: "back" },
        ];
      case "gateway":
        return []; // GatewayConfigurator renders its own footer
      case "google-oauth":
        return [{ key: "Esc", label: "cancel" }];
      default:
        return [
          {
            key: "Enter",
            label: subScreen === "connect" ? "next / save" : "select",
          },
          { key: "Esc", label: "back to list" },
        ];
    }
  };

  // ── Render ────────────────────────────────────────────────────────

  const renderSubScreen = () => {
    switch (subScreen) {
      case "list":
        return (
          <IntegrationList
            integrations={integrations}
            loading={loading}
            onSelect={handleSelect}
          />
        );

      case "connect":
        return selected ? (
          <ConnectForm
            integration={selected}
            onDone={(intg) => { markConnected(intg); goList(); }}
            onBack={goList}
          />
        ) : null;

      case "disconnect":
        return selected ? (
          <DisconnectConfirm
            integration={selected}
            onDisconnected={markDisconnected}
            onCancel={goList}
          />
        ) : null;

      case "reconfigure":
        return selected ? (
          <ReconfigureConfirm
            integration={selected}
            onReconfigure={() => {
              if (selected.name === "telegram" || selected.name === "discord") {
                setGatewayTarget(selected.name as GatewayPlatform);
                setSubScreen("gateway");
              } else if (selected.name === "google") {
                setSubScreen("google-oauth");
              }
            }}
            onDisconnect={() => setSubScreen("disconnect")}
            onCancel={goList}
          />
        ) : null;

      case "gateway":
        return gatewayTarget ? (
          <Box flexDirection="column" gap={1}>
            <Text color="white" bold>
              Gateway Configuration
            </Text>
            <Text color="gray" dimColor>
              Connect a messaging platform so your agent can receive messages.
            </Text>
            <GatewayConfigurator
              gateway={gatewayTarget}
              authToken={authToken}
              baseUrl={apiBaseUrl}
              onDone={() => {
                if (gatewayTarget) {
                  setIntegrations((prev) =>
                    prev.map((i) =>
                      i.name === gatewayTarget
                        ? {
                            ...i,
                            connected: true,
                            connectedAt: new Date().toISOString(),
                          }
                        : i,
                    ),
                  );
                }
                goList();
              }}
              onBack={goList}
            />
          </Box>
        ) : null;

      case "google-oauth":
        return (
          <GoogleOAuthScreen
            onDone={() => {
              setIntegrations((prev) =>
                prev.map((i) =>
                  i.name === "google"
                    ? { ...i, connected: true, connectedAt: new Date().toISOString() }
                    : i,
                ),
              );
              setTimeout(goList, 1500);
            }}
          />
        );
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      <Text color="cyan" bold>
        🔗 Integrations
      </Text>

      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
        marginTop={1}
        flexDirection="column"
      >
        {renderSubScreen()}
      </Box>

      <Box flexGrow={1} />

      <Footer hints={footerHints()} />
    </Box>
  );
}
