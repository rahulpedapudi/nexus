import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";

import { StepIndicator } from "../components/StepIndicator.js";
import { Footer } from "../components/Footer.js";
import { writeConfig } from "../config.js";

import { WelcomeStep } from "./wizard/WelcomeStep.js";
import { AccountStep } from "./wizard/AccountStep.js";
import { LLMStep } from "./wizard/LLMStep.js";
import { GatewayStep } from "./wizard/GatewayStep.js";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type WizardStep = "welcome" | "account" | "llm" | "gateway" | "done";

const STEPS: WizardStep[] = ["welcome", "account", "llm", "gateway", "done"];

const STEP_LABELS: Record<WizardStep, string> = {
  welcome: "Welcome",
  account: "Account",
  llm: "LLM Provider",
  gateway: "Gateway Config",
  done: "Done",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SetupWizardProps {
  onComplete: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupWizard({ onComplete, onBack }: SetupWizardProps) {
  const [stepIdx, setStepIdx] = useState(0);

  // Cross-step state collected as we proceed
  const [baseUrl] = useState("http://localhost:8421");
  const [token, setToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [savedUsername, setSavedUsername] = useState("");

  const step = STEPS[stepIdx]!;

  const nextStep = useCallback(() => {
    if (stepIdx < STEPS.length - 1) setStepIdx((s) => s + 1);
  }, [stepIdx]);

  // ── Global Esc / q handler ────────────────────────────────────────
  // Step-local Esc is handled inside each step component.
  // If Esc bubbles up here (e.g. from welcome or done), navigate back.
  useInput((input, key) => {
    if (key.escape || (input === "q" && step === "welcome")) {
      onBack();
    }
    if (step === "welcome" && key.return) nextStep();
    if (step === "done" && key.return) handleDoneSubmit();
  });

  // ── Done handler ──────────────────────────────────────────────────

  const handleDoneSubmit = useCallback(() => {
    writeConfig({ baseUrl, token, refreshToken, username: savedUsername });
    onComplete();
  }, [baseUrl, token, refreshToken, savedUsername, onComplete]);

  // ── Render each step ──────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case "welcome":
        return <WelcomeStep onContinue={nextStep} />;

      case "account":
        return (
          <AccountStep
            baseUrl={baseUrl}
            onDone={(tok, refresh, username) => {
              setToken(tok);
              setRefreshToken(refresh);
              setSavedUsername(username);
              nextStep();
            }}
          />
        );

      case "llm":
        return <LLMStep onDone={nextStep} />;

      case "gateway":
        return (
          <GatewayStep authToken={token} baseUrl={baseUrl} onDone={nextStep} />
        );

      case "done":
        return (
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
                <Text color="white">{token ? "•••••••• (saved)" : "—"}</Text>
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
    }
  };

  // ── Root layout ───────────────────────────────────────────────────

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
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
        flexGrow={1}
        gap={1}>
        {renderStep()}
      </Box>
    </Box>
  );
}
