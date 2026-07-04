import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

import { SpinnerRow } from "../../components/SpinnerRow.js";
import { MenuSelect } from "../../components/MenuSelect.js";
import { Footer } from "../../components/Footer.js";
import { writeCredentials } from "../../config.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LLM_PROVIDERS = [
  { label: "Groq", value: "groq" },
  { label: "OpenRouter", value: "openrouter" },
  { label: "Skip for now", value: "skip" },
];

const EMBEDDING_MODELS = [
  { label: "Gemini Embedding 2", value: "gemini-embedding-2" },
  { label: "Skip for now", value: "skip" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LLMStepProps {
  onDone: () => void;
}

export function LLMStep({ onDone }: LLMStepProps) {
  // Phase 1: LLM provider
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [llmProviderDone, setLlmProviderDone] = useState(false);

  // Phase 2: Embedding model
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<
    string | null
  >(null);
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");

  const [savingKey, setSavingKey] = useState(false);
  const [llmError, setLlmError] = useState("");

  // ── Esc handling ──────────────────────────────────────────────────

  useInput((_input, key) => {
    if (!key.escape) return;
    if (llmProviderDone) { setLlmProviderDone(false); setLlmError(""); return; }
    if (selectedProvider) { setSelectedProvider(null); setApiKey(""); setLlmError(""); return; }
  });

  // ── LLM Provider ──────────────────────────────────────────────────

  const handleLLMProviderSelect = useCallback((item: { value: string }) => {
    if (item.value === "skip") { setLlmProviderDone(true); return; }
    setSelectedProvider(item.value);
  }, []);

  const handleLLMKeySubmit = useCallback(async () => {
    if (!selectedProvider || !apiKey) return;
    setSavingKey(true);
    setLlmError("");
    try {
      writeCredentials({
        LLM_PROVIDER: selectedProvider,
        [selectedProvider === "groq" ? "GROQ_API_KEY" : "OPENROUTER_API_KEY"]: apiKey,
      });
      setLlmProviderDone(true);
    } catch (err: unknown) {
      setLlmError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingKey(false);
    }
  }, [selectedProvider, apiKey]);

  // ── Embedding model ───────────────────────────────────────────────

  const handleEmbeddingModelSelect = useCallback((item: { value: string }) => {
    if (item.value === "skip") { onDone(); return; }
    setSelectedEmbeddingModel(item.value);
  }, [onDone]);

  const handleEmbeddingApiKeySubmit = useCallback(async () => {
    if (!selectedEmbeddingModel || !embeddingApiKey) return;
    setSavingKey(true);
    setLlmError("");
    try {
      writeCredentials({ EMBEDDING_MODEL: selectedEmbeddingModel, GOOGLE_API_KEY: embeddingApiKey });
      onDone();
    } catch (err: unknown) {
      setLlmError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingKey(false);
    }
  }, [selectedEmbeddingModel, embeddingApiKey, onDone]);

  // ── Render ────────────────────────────────────────────────────────

  if (!llmProviderDone) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="white" bold>LLM Provider</Text>
        <Text color="gray" dimColor>Select your language model provider:</Text>

        {!selectedProvider ? (
          <MenuSelect items={LLM_PROVIDERS} onSelect={handleLLMProviderSelect} />
        ) : (
          <Box flexDirection="column" gap={1}>
            <Text color="green">Provider: <Text bold>{selectedProvider}</Text></Text>
            <Text color="gray" dimColor>Enter your API key:</Text>
            <Box borderStyle="round" borderColor="cyan" paddingX={1}>
              <TextInput value={apiKey} onChange={setApiKey} onSubmit={handleLLMKeySubmit} mask="*" placeholder="sk-..." />
            </Box>
            {savingKey && <SpinnerRow label="Saving key…" />}
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
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="white" bold>Embedding Model</Text>
      <Text color="gray" dimColor>Select your embedding model:</Text>

      {!selectedEmbeddingModel ? (
        <MenuSelect items={EMBEDDING_MODELS} onSelect={handleEmbeddingModelSelect} />
      ) : (
        <Box flexDirection="column" gap={1}>
          <Text color="green">Model: <Text bold>{selectedEmbeddingModel}</Text></Text>
          <Text color="gray" dimColor>Enter your API key:</Text>
          <Box borderStyle="round" borderColor="cyan" paddingX={1}>
            <TextInput value={embeddingApiKey} onChange={setEmbeddingApiKey} onSubmit={handleEmbeddingApiKeySubmit} mask="*" placeholder="sk-..." />
          </Box>
          {savingKey && <SpinnerRow label="Saving key…" />}
          {llmError && <Text color="red">✗ {llmError}</Text>}
        </Box>
      )}

      <Footer
        hints={[
          { key: "Enter", label: selectedEmbeddingModel ? "save key" : "select" },
          { key: "Esc", label: "back" },
        ]}
      />
    </Box>
  );
}
