import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";

interface LLMInfo {
  llm: string;
  model: string;
}

interface ChatInputProps {
  input: string;
  onChange: (val: string) => void;
  onSubmit: (val: string) => void;
  streaming: boolean;
  streamPhase: string;
  activeTool: string;
  showPalette: boolean;
  deleteConfirm: boolean;
  llm?: LLMInfo;
  loadingLLM: boolean;
}

export function ChatInput({
  input,
  onChange,
  onSubmit,
  streaming,
  streamPhase,
  activeTool,
  showPalette,
  deleteConfirm,
  llm,
  loadingLLM,
}: ChatInputProps) {
  return (
    <Box flexDirection="column" marginX={1} marginTop={1} paddingBottom={1}>
      {/* Input box */}
      <Box
        borderLeftColor="cyan"
        borderLeft={true}
        flexDirection="row"
        paddingX={1}
        paddingY={1}
      >
        <Box marginRight={1}>
          <Text color="cyan" bold>
            {">"}
          </Text>
        </Box>
        {streaming ? (
          <Box gap={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text color="gray">
              {activeTool
                ? `Using ${activeTool}…`
                : streamPhase === "thinking"
                  ? "Thinking…"
                  : "Streaming…"}
            </Text>
            <Text color="gray" dimColor>
              Ctrl+C to cancel
            </Text>
          </Box>
        ) : (
          <Box flexGrow={1}>
            <TextInput
              value={input}
              onChange={onChange}
              onSubmit={onSubmit}
              focus={true}
              placeholder=""
            />
          </Box>
        )}
      </Box>

      {/* Status/hints bar */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        paddingX={1}
        marginTop={1}
      >
        <Box flexDirection="row" gap={2}>
          {showPalette || deleteConfirm ? (
            <>
              <Text color="gray">
                <Text color="white">↑↓</Text> select command
              </Text>
              <Text color="gray">
                <Text color="white">enter</Text> run
              </Text>
              <Text color="gray">
                <Text color="white">esc</Text> dismiss
              </Text>
            </>
          ) : (
            <>
              <Text color="gray">
                <Text color="white">enter</Text> send
              </Text>
              <Text color="gray">
                <Text color="white">/</Text> commands
              </Text>
            </>
          )}
        </Box>
        {loadingLLM ? (
          <Spinner type="dots" />
        ) : (
          <Text color="gray" dimColor>
            {llm?.llm} - {llm?.model}
          </Text>
        )}
      </Box>
    </Box>
  );
}
