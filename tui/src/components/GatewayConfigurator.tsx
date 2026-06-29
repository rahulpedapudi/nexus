import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";

import { Footer } from "./Footer.js";
import { getGatewayLinkToken, enableGateway } from "../api/client.js";
import { writeCredentials } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GatewayPlatform = "telegram" | "discord";

type GatewaySubStep = "enter-token" | "show-link";

const GATEWAY_DOCS: Record<GatewayPlatform, string> = {
  telegram: "https://docs.nexus.example/gateways/telegram",
  discord: "https://docs.nexus.example/gateways/discord",
};

interface GatewayConfiguratorProps {
  /** Which platform to configure (telegram | discord). */
  gateway: GatewayPlatform;
  /** Auth token used to call the backend. */
  authToken: string;
  /** Base URL of the Nexus backend. */
  baseUrl: string;
  /**
   * Called when the user finishes the "show-link" step and presses Enter,
   * or when they explicitly complete the flow.
   */
  onDone: () => void;
  /** Called when the user presses Esc to go back. */
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GatewayConfigurator({
  gateway,
  authToken,
  baseUrl,
  onDone,
  onBack,
}: GatewayConfiguratorProps) {
  const [subStep, setSubStep] = useState<GatewaySubStep>("enter-token");
  const [botToken, setBotToken] = useState("");
  const [linkToken, setLinkToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // -------------------------------------------------------------------------
  // Keyboard: Esc navigation
  // -------------------------------------------------------------------------

  useInput((_, key) => {
    if (key.escape) {
      if (subStep === "show-link") {
        // Go back to enter-token
        setSubStep("enter-token");
        setLinkToken("");
        setError("");
      } else {
        onBack();
      }
    }

    if (key.return && subStep === "show-link") {
      onDone();
    }
  });

  // -------------------------------------------------------------------------
  // Submit bot token → call API → advance to show-link
  // -------------------------------------------------------------------------

  const handleBotTokenSubmit = useCallback(async () => {
    if (!botToken.trim()) {
      setError("Bot token cannot be empty.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await getGatewayLinkToken(gateway, authToken, baseUrl);

      writeCredentials({
        [gateway]: { token: botToken.trim() },
      });

      await enableGateway(gateway, authToken, baseUrl);

      setLinkToken(res.token);
      setSubStep("show-link");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gateway, botToken, authToken, baseUrl]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const platformLabel = gateway === "telegram" ? "📨 Telegram" : "🎮 Discord";
  const platformName = gateway === "telegram" ? "Telegram" : "Discord";

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={2} alignItems="center">
        <Text color="green" bold>
          {platformLabel}
        </Text>
      </Box>

      {/* ---- Enter Token ---- */}
      {subStep === "enter-token" && (
        <>
          <Box flexDirection="column" gap={0}>
            <Text color="gray" dimColor>
              {gateway === "telegram"
                ? "Create a bot via @BotFather and paste the bot token below."
                : "Create a Discord bot and paste the bot token below."}
            </Text>
            <Text color="cyan" dimColor>
              📖 Docs: {GATEWAY_DOCS[gateway]}
            </Text>
          </Box>

          <Box flexDirection="column" gap={0}>
            <Text color="cyan">Bot Token</Text>
            <Box borderStyle="round" borderColor="cyan" paddingX={1}>
              <TextInput
                value={botToken}
                onChange={setBotToken}
                onSubmit={handleBotTokenSubmit}
                placeholder={
                  gateway === "telegram" ? "1234567890:AAF..." : "MTY4..."
                }
              />
            </Box>
          </Box>

          {loading && (
            <Box gap={1}>
              <Text color="cyan">
                <Spinner type="dots" />
              </Text>
              <Text color="cyan">Connecting to gateway…</Text>
            </Box>
          )}
          {error && <Text color="red">✗ {error}</Text>}

          <Footer
            hints={[
              { key: "Enter", label: "connect" },
              { key: "Esc", label: "back" },
            ]}
          />
        </>
      )}

      {/* ---- Show Link Token ---- */}
      {subStep === "show-link" && (
        <>
          <Box gap={2} alignItems="center">
            <Text color="green" bold>
              ✓ Token generated!
            </Text>
          </Box>

          <Text color="gray" dimColor>
            Copy the link token below and send it to your bot:
          </Text>

          <Text color="yellow" dimColor>
            Token will expire in 5 minutes!
          </Text>

          <Box flexDirection="column" gap={1} marginTop={1}>
            <Text color="gray" dimColor>
              Now open your{" "}
              <Text color="white" bold>
                {platformName} bot
              </Text>{" "}
              and send this command:
            </Text>
            <Box borderStyle="round" borderColor="cyan" paddingX={2}>
              <Text color="cyan" bold>
                /link {linkToken}
              </Text>
              <Text color="gray" dimColor>
                {"  "}CTRL + SHIFT + C to copy
              </Text>
            </Box>
            <Text color="gray" dimColor>
              The bot will confirm once linked successfully.
            </Text>
          </Box>

          <Footer
            hints={[
              { key: "Enter", label: "continue" },
              { key: "Esc", label: "back" },
            ]}
          />
        </>
      )}
    </Box>
  );
}
