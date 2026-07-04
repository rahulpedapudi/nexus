import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { SpinnerRow } from "../../components/SpinnerRow.js";
import { useGoogleOAuth } from "../../hooks/useGoogleOAuth.js";
import { handleGoogleCreds } from "../../config.js";

interface GoogleOAuthScreenProps {
  /** Called after a successful connection. */
  onDone: () => void;
}

export function GoogleOAuthScreen({ onDone }: GoogleOAuthScreenProps) {
  const [credentialsFilePath, setCredentialsFilePath] = useState("");
  const [fileError, setFileError] = useState("");

  const {
    googleAuthUrl,
    googleOAuthStatus,
    googleError,
    startGoogleOAuth,
    goToSetup,
  } = useGoogleOAuth(onDone);

  const handleFilePathSubmit = () => {
    if (!credentialsFilePath) return;
    if (!credentialsFilePath.endsWith(".json")) {
      setFileError("Please provide a valid JSON file path.");
      return;
    }
    setFileError("");
    try {
      handleGoogleCreds(credentialsFilePath);
      startGoogleOAuth();
    } catch (err: any) {
      setFileError(err.message);
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>
        🔑 Connect Google Calendar
      </Text>

      {googleOAuthStatus === "setup" && (
        <Box flexDirection="column" gap={1}>
          <Text color="yellow">Setup Google Cloud Console Project</Text>
          <Text color="gray" dimColor>
            Follow these steps to set up a Google Cloud Console project and
            enable the Google Calendar API.
          </Text>
          <Box
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            paddingY={0}
            marginY={0}
          >
            <Text color="yellow" dimColor>
              https://nexus.ai/docs/integrations/google
            </Text>
          </Box>

          <Text color="cyan">Enter the path of the credentials file: </Text>
          <Box borderStyle="round" borderColor="cyan" paddingX={1}>
            <TextInput
              value={credentialsFilePath}
              onChange={setCredentialsFilePath}
              onSubmit={handleFilePathSubmit}
              placeholder={"/home…"}
            />
          </Box>
          {fileError && <Text color="red">✗ {fileError}</Text>}
        </Box>
      )}

      {googleOAuthStatus === "waiting" && (
        <SpinnerRow label="Generating authorization URL…" />
      )}

      {googleOAuthStatus === "open-browser" && (
        <Box flexDirection="column" gap={1}>
          <Text color="green">✓ Open this URL in your browser to sign in:</Text>
          <Box
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            paddingY={0}
            marginY={0}
          >
            <Text color="cyan" wrap="wrap">
              {googleAuthUrl}
            </Text>
          </Box>
          <Box gap={1} marginTop={1}>
            <SpinnerRow label="Waiting for you to complete sign-in in the browser…" color="gray" />
          </Box>
          <Text color="gray" dimColor>
            Press Esc to cancel.
          </Text>
        </Box>
      )}

      {googleOAuthStatus === "done" && (
        <Box gap={1}>
          <Text color="green">✓ Google Calendar connected successfully!</Text>
        </Box>
      )}

      {googleOAuthStatus === "error" && (
        <Box flexDirection="column" gap={1}>
          <Text color="red">✗ OAuth failed: {googleError}</Text>
          <Text color="gray" dimColor>
            Press Esc to go back and try again.
          </Text>
        </Box>
      )}
    </Box>
  );
}
