import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

import { SpinnerRow } from "../../components/SpinnerRow.js";
import { MenuSelect } from "../../components/MenuSelect.js";
import { Footer } from "../../components/Footer.js";
import { setupUser, login } from "../../api/client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccountMode = "pick" | "register" | "login";
type RegisterField = "email" | "username" | "password";
type LoginField = "username" | "password";

interface AccountStepProps {
  baseUrl: string;
  onDone: (token: string, refreshToken: string, username: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountStep({ baseUrl, onDone }: AccountStepProps) {
  const [accountMode, setAccountMode] = useState<AccountMode>("pick");
  const [accountError, setAccountError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Register
  const [email, setEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regField, setRegField] = useState<RegisterField>("email");

  // Login
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginField, setLoginField] = useState<LoginField>("username");

  // ── Register handlers ─────────────────────────────────────────────

  const handleRegisterNext = useCallback(async () => {
    if (regField === "email") { setRegField("username"); return; }
    if (regField === "username") { setRegField("password"); return; }
    if (!email || !regUsername || !regPassword) {
      setAccountError("All fields are required.");
      return;
    }
    setSubmitting(true);
    setAccountError("");
    try {
      await setupUser({ email, username: regUsername, password: regPassword }, baseUrl);
      const tokenRes = await login(regUsername, regPassword, baseUrl);
      onDone(tokenRes.access_token, tokenRes.refresh_token, regUsername);
    } catch (err: unknown) {
      setAccountError(err instanceof Error ? err.message : String(err));
      setRegField("email");
    } finally {
      setSubmitting(false);
    }
  }, [regField, email, regUsername, regPassword, baseUrl, onDone]);

  // ── Login handlers ────────────────────────────────────────────────

  const handleLoginNext = useCallback(async () => {
    if (loginField === "username") { setLoginField("password"); return; }
    if (!loginUsername || !loginPassword) {
      setAccountError("Username and password are required.");
      return;
    }
    setSubmitting(true);
    setAccountError("");
    try {
      const tokenRes = await login(loginUsername, loginPassword, baseUrl);
      onDone(tokenRes.access_token, tokenRes.refresh_token, loginUsername);
    } catch (err: unknown) {
      setAccountError(err instanceof Error ? err.message : String(err));
      setLoginField("username");
    } finally {
      setSubmitting(false);
    }
  }, [loginField, loginUsername, loginPassword, baseUrl, onDone]);

  // ── Esc: go back to mode picker within this step ──────────────────

  useInput((_input, key) => {
    if (key.escape && accountMode !== "pick") {
      setAccountMode("pick");
      setAccountError("");
    }
  });

  // ── Mode picker ───────────────────────────────────────────────────

  if (accountMode === "pick") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="white" bold>
          How would you like to continue?
        </Text>
        <Text color="gray" dimColor>
          Choose one of the options below:
        </Text>
        <MenuSelect
          items={[
            { label: "🆕  Register — create a new Nexus account", value: "register" },
            { label: "🔑  Log in  — I already have an account", value: "login" },
          ]}
          onSelect={(item) => {
            setAccountMode(item.value as AccountMode);
            setAccountError("");
            setRegField("email");
            setLoginField("username");
          }}
        />
        <Footer
          hints={[
            { key: "↑↓", label: "navigate" },
            { key: "Enter", label: "select" },
            { key: "Esc", label: "back" },
          ]}
        />
      </Box>
    );
  }

  // ── Register form ─────────────────────────────────────────────────

  if (accountMode === "register") {
    return (
      <Box flexDirection="column" gap={1}>
        <Box gap={2} alignItems="center">
          <Text color="cyan">←</Text>
          <Text color="white" bold>Create Account</Text>
        </Box>
        <Text color="gray" dimColor>This will be your Nexus administrator account.</Text>

        {(["email", "username", "password"] as RegisterField[]).map((field) => (
          <Box key={field} flexDirection="column" gap={0}>
            <Text color={regField === field ? "cyan" : "gray"}>
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </Text>
            <Box
              borderStyle="round"
              borderColor={regField === field ? "cyan" : "gray"}
              paddingX={1}
            >
              <TextInput
                value={field === "email" ? email : field === "username" ? regUsername : regPassword}
                onChange={field === "email" ? setEmail : field === "username" ? setRegUsername : setRegPassword}
                onSubmit={handleRegisterNext}
                focus={regField === field}
                mask={field === "password" ? "*" : undefined}
                placeholder={field === "email" ? "admin@example.com" : field === "username" ? "admin" : "••••••••"}
              />
            </Box>
          </Box>
        ))}

        {submitting && <SpinnerRow label="Creating account…" />}
        {accountError && <Text color="red">✗ {accountError}</Text>}

        <Footer
          hints={[
            { key: "Enter", label: regField === "password" ? "create account" : "next field" },
            { key: "Esc", label: "back to options" },
          ]}
        />
      </Box>
    );
  }

  // ── Login form ────────────────────────────────────────────────────

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={2} alignItems="center">
        <Text color="cyan">←</Text>
        <Text color="white" bold>Log In</Text>
      </Box>
      <Text color="gray" dimColor>Enter your existing Nexus credentials.</Text>

      {(["username", "password"] as LoginField[]).map((field) => (
        <Box key={field} flexDirection="column" gap={0}>
          <Text color={loginField === field ? "cyan" : "gray"}>
            {field.charAt(0).toUpperCase() + field.slice(1)}
          </Text>
          <Box
            borderStyle="round"
            borderColor={loginField === field ? "cyan" : "gray"}
            paddingX={1}
          >
            <TextInput
              value={field === "username" ? loginUsername : loginPassword}
              onChange={field === "username" ? setLoginUsername : setLoginPassword}
              onSubmit={handleLoginNext}
              focus={loginField === field}
              mask={field === "password" ? "*" : undefined}
              placeholder={field === "username" ? "admin" : "••••••••"}
            />
          </Box>
        </Box>
      ))}

      {submitting && <SpinnerRow label="Signing in…" />}
      {accountError && <Text color="red">✗ {accountError}</Text>}

      <Footer
        hints={[
          { key: "Enter", label: loginField === "password" ? "sign in" : "next field" },
          { key: "Esc", label: "back to options" },
        ]}
      />
    </Box>
  );
}
