import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";

import { StepIndicator } from "../components/StepIndicator.js";
import { Footer } from "../components/Footer.js";
import { pingHealth, setupUser, login, createKey } from "../api/client.js";
import { writeConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

// ! i dont think connection step should be present
type WizardStep = "welcome" | "connection" | "account" | "llm" | "done";

const STEPS: WizardStep[] = ["welcome", "connection", "account", "llm", "done"];

const STEP_LABELS: Record<WizardStep, string> = {
  welcome: "Welcome",
  connection: "Connection",
  account: "Account",
  llm: "LLM Provider",
  done: "Done",
};

// TODO: this must be fetched from the API
const LLM_PROVIDERS = [
  { label: "Groq", value: "groq" },
  { label: "OpenRouter", value: "openrouter" },
  { label: "Skip for now", value: "skip" },
];

// "mode" within the account step
type AccountMode = "pick" | "register" | "login";

// Which field is focused inside register / login forms
type RegisterField = "email" | "username" | "password";
type LoginField = "username" | "password";

interface SetupWizardProps {
  onComplete: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SetupWizard({ onComplete, onBack }: SetupWizardProps) {
  const [stepIdx, setStepIdx] = useState(0);

  // --- Connection step ---
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000");
  const [checking, setChecking] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "ok" | "error"
  >("idle");
  const [connectionError, setConnectionError] = useState("");

  // --- Account step ---
  const [accountMode, setAccountMode] = useState<AccountMode>("pick");

  // Register fields
  const [email, setEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regField, setRegField] = useState<RegisterField>("email");

  // Login fields
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginField, setLoginField] = useState<LoginField>("username");

  const [submitting, setSubmitting] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [token, setToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  // username that ends up in config — set by whichever path succeeds
  const [savedUsername, setSavedUsername] = useState("");

  // --- LLM step ---
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [llmError, setLlmError] = useState("");

  const step = STEPS[stepIdx]!;

  // -------------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------------

  const nextStep = useCallback(() => {
    if (stepIdx < STEPS.length - 1) setStepIdx((s) => s + 1);
  }, [stepIdx]);

  useInput((input, key) => {
    if (key.escape) {
      // Inside account step: go back to mode picker, then to previous step
      if (step === "account" && accountMode !== "pick") {
        setAccountMode("pick");
        setAccountError("");
        return;
      }
      // onback sets screen to chat if config is ready and main-menu if not ready
      onBack();
    }
    if (input === "q" && step === "welcome") {
      onBack();
    }
  });

  // -------------------------------------------------------------------------
  // Step: Welcome
  // -------------------------------------------------------------------------

  const NEXUS_LOGO = `
 ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
 ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
 ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
 ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
 ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
 ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`.trim();

  const renderWelcome = () => (
    <Box flexDirection="column" gap={1}>
      {NEXUS_LOGO.split("\n").map((line, i) => (
        <Text key={i} color="cyan" bold>
          {line}
        </Text>
      ))}
      <Box marginTop={1} flexDirection="column" gap={1}>
        <Text color="white">Welcome to the Nexus setup wizard.</Text>
        <Text color="gray" dimColor>
          Your self-hosted AI agent will be configured in a few steps.
        </Text>
        <Text color="gray" dimColor>
          This wizard will help you:
        </Text>
        <Text color="gray" dimColor>
          {" "}
          • Verify API connectivity
        </Text>
        <Text color="gray" dimColor>
          {" "}
          • Sign in or create an account
        </Text>
        <Text color="gray" dimColor>
          {" "}
          • Configure your LLM provider
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color="cyan" bold>
          Press Enter to begin →
        </Text>
      </Box>
      <Footer
        hints={[
          { key: "Enter", label: "continue" },
          { key: "Esc / q", label: "back to menu" },
        ]}
      />
    </Box>
  );

  // -------------------------------------------------------------------------
  // Step: Connection
  // -------------------------------------------------------------------------

  const handleConnectionSubmit = useCallback(async () => {
    setChecking(true);
    setConnectionStatus("idle");
    setConnectionError("");
    const result = await pingHealth(baseUrl);
    setChecking(false);
    if (result.ok) {
      setConnectionStatus("ok");
      setTimeout(() => nextStep(), 800);
    } else {
      setConnectionStatus("error");
      setConnectionError(
        `Could not reach ${baseUrl} — check the URL and try again`,
      );
    }
  }, [baseUrl, nextStep]);

  const renderConnection = () => (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>
        Nexus API URL
      </Text>
      <Text color="gray" dimColor>
        Enter the base URL of your Nexus instance:
      </Text>
      <Box
        borderStyle="round"
        borderColor={connectionStatus === "error" ? "red" : "cyan"}
        paddingX={1}>
        <TextInput
          value={baseUrl}
          onChange={setBaseUrl}
          onSubmit={handleConnectionSubmit}
          placeholder="http://localhost:8000"
        />
      </Box>

      {checking && (
        <Box gap={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="cyan">Connecting to {baseUrl}…</Text>
        </Box>
      )}
      {connectionStatus === "ok" && (
        <Text color="green">✓ Connected successfully!</Text>
      )}
      {connectionStatus === "error" && (
        <Text color="red">✗ {connectionError}</Text>
      )}

      <Footer
        hints={[
          { key: "Enter", label: "test connection" },
          { key: "Esc", label: "back" },
        ]}
      />
    </Box>
  );

  // -------------------------------------------------------------------------
  // Step: Account — mode picker
  // -------------------------------------------------------------------------

  const MODE_ITEMS = [
    { label: "🆕  Register — create a new Nexus account", value: "register" },
    { label: "🔑  Log in  — I already have an account", value: "login" },
  ];

  const handleModeSelect = useCallback((item: { value: string }) => {
    setAccountMode(item.value as AccountMode);
    setAccountError("");
    // Reset both form states when switching modes
    setRegField("email");
    setLoginField("username");
  }, []);

  const renderModePicker = () => (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>
        How would you like to continue?
      </Text>
      <Text color="gray" dimColor>
        Choose one of the options below:
      </Text>
      <SelectInput
        items={MODE_ITEMS}
        onSelect={handleModeSelect}
        indicatorComponent={({ isSelected }) => (
          <Text color="cyan">{isSelected ? "▶ " : "  "}</Text>
        )}
        itemComponent={({ isSelected, label }) => (
          <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
            {label}
          </Text>
        )}
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

  // -------------------------------------------------------------------------
  // Step: Account — Register sub-form
  // -------------------------------------------------------------------------

  const handleRegisterNext = useCallback(async () => {
    if (regField === "email") {
      setRegField("username");
      return;
    }
    if (regField === "username") {
      setRegField("password");
      return;
    }

    // Submit
    if (!email || !regUsername || !regPassword) {
      setAccountError("All fields are required.");
      return;
    }
    setSubmitting(true);
    setAccountError("");
    try {
      await setupUser(
        { email, username: regUsername, password: regPassword },
        baseUrl,
      );
      const tokenRes = await login(regUsername, regPassword, baseUrl);
      setToken(tokenRes.access_token);
      setRefreshToken(tokenRes.refresh_token);
      setSavedUsername(regUsername);
      nextStep();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAccountError(msg);
      setRegField("email");
    } finally {
      setSubmitting(false);
    }
  }, [regField, email, regUsername, regPassword, baseUrl, nextStep]);

  const renderRegister = () => (
    <Box flexDirection="column" gap={1}>
      <Box gap={2} alignItems="center">
        <Text color="cyan">←</Text>
        <Text color="white" bold>
          Create Account
        </Text>
      </Box>
      <Text color="gray" dimColor>
        This will be your Nexus administrator account.
      </Text>

      {/* Email */}
      <Box flexDirection="column" gap={0}>
        <Text color={regField === "email" ? "cyan" : "gray"}>Email</Text>
        <Box
          borderStyle="round"
          borderColor={regField === "email" ? "cyan" : "gray"}
          paddingX={1}>
          <TextInput
            value={email}
            onChange={setEmail}
            onSubmit={handleRegisterNext}
            focus={regField === "email"}
            placeholder="admin@example.com"
          />
        </Box>
      </Box>

      {/* Username */}
      <Box flexDirection="column" gap={0}>
        <Text color={regField === "username" ? "cyan" : "gray"}>Username</Text>
        <Box
          borderStyle="round"
          borderColor={regField === "username" ? "cyan" : "gray"}
          paddingX={1}>
          <TextInput
            value={regUsername}
            onChange={setRegUsername}
            onSubmit={handleRegisterNext}
            focus={regField === "username"}
            placeholder="admin"
          />
        </Box>
      </Box>

      {/* Password */}
      <Box flexDirection="column" gap={0}>
        <Text color={regField === "password" ? "cyan" : "gray"}>Password</Text>
        <Box
          borderStyle="round"
          borderColor={regField === "password" ? "cyan" : "gray"}
          paddingX={1}>
          <TextInput
            value={regPassword}
            onChange={setRegPassword}
            onSubmit={handleRegisterNext}
            focus={regField === "password"}
            mask="*"
            placeholder="••••••••"
          />
        </Box>
      </Box>

      {submitting && (
        <Box gap={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="cyan">Creating account…</Text>
        </Box>
      )}
      {accountError && <Text color="red">✗ {accountError}</Text>}

      <Footer
        hints={[
          {
            key: "Enter",
            label: regField === "password" ? "create account" : "next field",
          },
          { key: "Esc", label: "back to options" },
        ]}
      />
    </Box>
  );

  // -------------------------------------------------------------------------
  // Step: Account — Login sub-form
  // -------------------------------------------------------------------------

  const handleLoginNext = useCallback(async () => {
    if (loginField === "username") {
      setLoginField("password");
      return;
    }

    // Submit
    if (!loginUsername || !loginPassword) {
      setAccountError("Username and password are required.");
      return;
    }
    setSubmitting(true);
    setAccountError("");
    try {
      const tokenRes = await login(loginUsername, loginPassword, baseUrl);
      setToken(tokenRes.access_token);
      setRefreshToken(tokenRes.refresh_token);
      setSavedUsername(loginUsername);
      nextStep();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAccountError(msg);
      setLoginField("username");
    } finally {
      setSubmitting(false);
    }
  }, [loginField, loginUsername, loginPassword, baseUrl, nextStep]);

  const renderLogin = () => (
    <Box flexDirection="column" gap={1}>
      <Box gap={2} alignItems="center">
        <Text color="cyan">←</Text>
        <Text color="white" bold>
          Log In
        </Text>
      </Box>
      <Text color="gray" dimColor>
        Enter your existing Nexus credentials.
      </Text>

      {/* Username */}
      <Box flexDirection="column" gap={0}>
        <Text color={loginField === "username" ? "cyan" : "gray"}>
          Username
        </Text>
        <Box
          borderStyle="round"
          borderColor={loginField === "username" ? "cyan" : "gray"}
          paddingX={1}>
          <TextInput
            value={loginUsername}
            onChange={setLoginUsername}
            onSubmit={handleLoginNext}
            focus={loginField === "username"}
            placeholder="admin"
          />
        </Box>
      </Box>

      {/* Password */}
      <Box flexDirection="column" gap={0}>
        <Text color={loginField === "password" ? "cyan" : "gray"}>
          Password
        </Text>
        <Box
          borderStyle="round"
          borderColor={loginField === "password" ? "cyan" : "gray"}
          paddingX={1}>
          <TextInput
            value={loginPassword}
            onChange={setLoginPassword}
            onSubmit={handleLoginNext}
            focus={loginField === "password"}
            mask="*"
            placeholder="••••••••"
          />
        </Box>
      </Box>

      {submitting && (
        <Box gap={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="cyan">Signing in…</Text>
        </Box>
      )}
      {accountError && <Text color="red">✗ {accountError}</Text>}

      <Footer
        hints={[
          {
            key: "Enter",
            label: loginField === "password" ? "sign in" : "next field",
          },
          { key: "Esc", label: "back to options" },
        ]}
      />
    </Box>
  );

  // -------------------------------------------------------------------------
  // Step: Account — top-level dispatcher
  // -------------------------------------------------------------------------

  const renderAccount = () => {
    if (accountMode === "register") return renderRegister();
    if (accountMode === "login") return renderLogin();
    return renderModePicker();
  };

  // -------------------------------------------------------------------------
  // Step: LLM Provider
  // -------------------------------------------------------------------------

  const handleLLMProviderSelect = useCallback(
    (item: { value: string }) => {
      if (item.value === "skip") {
        nextStep();
        return;
      }
      setSelectedProvider(item.value);
    },
    [nextStep],
  );

  const handleLLMKeySubmit = useCallback(async () => {
    if (!selectedProvider || !apiKey) return;
    setSavingKey(true);
    setLlmError("");
    try {
      await createKey({ provider: selectedProvider, key: apiKey });
      nextStep();
    } catch (err: unknown) {
      setLlmError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingKey(false);
    }
  }, [selectedProvider, apiKey, nextStep]);

  const renderLLM = () => (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>
        LLM Provider
      </Text>
      <Text color="gray" dimColor>
        Select your language model provider:
      </Text>

      {!selectedProvider ? (
        <SelectInput
          items={LLM_PROVIDERS}
          onSelect={handleLLMProviderSelect}
          indicatorComponent={({ isSelected }) => (
            <Text color="cyan">{isSelected ? "▶ " : "  "}</Text>
          )}
          itemComponent={({ isSelected, label }) => (
            <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
              {label}
            </Text>
          )}
        />
      ) : (
        <Box flexDirection="column" gap={1}>
          <Text color="green">
            Provider: <Text bold>{selectedProvider}</Text>
          </Text>
          <Text color="gray" dimColor>
            Enter your API key:
          </Text>
          <Box borderStyle="round" borderColor="cyan" paddingX={1}>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleLLMKeySubmit}
              mask="*"
              placeholder="sk-..."
            />
          </Box>
          {savingKey && (
            <Box gap={1}>
              <Text color="cyan">
                <Spinner type="dots" />
              </Text>
              <Text color="cyan">Saving key…</Text>
            </Box>
          )}
          {llmError && <Text color="red">✗ {llmError}</Text>}
        </Box>
      )}

      <Footer
        hints={[
          { key: "Enter", label: selectedProvider ? "save key" : "select" },
          { key: "Esc", label: "back" },
        ]}
      />
    </Box>
  );

  // -------------------------------------------------------------------------
  // Step: Done
  // -------------------------------------------------------------------------

  const handleDoneSubmit = useCallback(() => {
    writeConfig({
      baseUrl,
      token,
      refreshToken,
      username: savedUsername,
    });
    onComplete();
  }, [baseUrl, token, refreshToken, savedUsername, onComplete]);

  useInput((_, key) => {
    if (step === "welcome" && key.return) nextStep();
    if (step === "done" && key.return) handleDoneSubmit();
  });

  const renderDone = () => (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" alignItems="center" gap={1}>
        <Text color="green" bold>
          ╔══════════════════════════════╗
        </Text>
        <Text color="green" bold>
          ║ ✓ Nexus is Ready! ║
        </Text>
        <Text color="green" bold>
          ╚══════════════════════════════╝
        </Text>
      </Box>

      <Box flexDirection="column" gap={1} marginTop={1}>
        <Box gap={2}>
          <Text color="gray">API URL </Text>
          <Text color="cyan" bold>
            {baseUrl}
          </Text>
        </Box>
        <Box gap={2}>
          <Text color="gray">Username </Text>
          <Text color="white">{savedUsername}</Text>
        </Box>
        <Box gap={2}>
          <Text color="gray">Auth Token</Text>
          <Text color="white">{token ? "••••••••  (saved)" : "—"}</Text>
        </Box>
      </Box>

      <Text color="gray" dimColor>
        Configuration will be saved to ~/.nexus/cli-config.json
      </Text>

      <Box marginTop={1}>
        <Text color="cyan" bold>
          Press Enter to start chatting →
        </Text>
      </Box>

      <Footer hints={[{ key: "Enter", label: "open chat" }]} />
    </Box>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const STEP_RENDERERS: Record<WizardStep, () => JSX.Element> = {
    welcome: renderWelcome,
    connection: renderConnection,
    account: renderAccount,
    llm: renderLLM,
    done: renderDone,
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <StepIndicator
        current={stepIdx}
        total={STEPS.length}
        label={STEP_LABELS[step]}
      />
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
        flexDirection="column"
        gap={1}>
        {STEP_RENDERERS[step]()}
      </Box>
    </Box>
  );
}
