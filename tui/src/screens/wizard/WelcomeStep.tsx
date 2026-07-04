import React from "react";
import { Box, Text } from "ink";

import { Logo } from "../../components/Logo.js";
import { Footer } from "../../components/Footer.js";

interface WelcomeStepProps {
  onContinue: () => void;
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  // onContinue is called from the parent's useInput for key.return
  return (
    <Box flexDirection="column" gap={1}>
      <Logo color="cyan" />
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
          • Sign in or create an account
        </Text>
        <Text color="gray" dimColor>
          {" "}
          • Configure your LLM provider
        </Text>
        <Text color="gray" dimColor>
          {" "}
          • Configure your Gateways
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
}
