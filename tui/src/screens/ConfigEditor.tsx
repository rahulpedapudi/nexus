import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";

import { Footer } from "../components/Footer.js";
import { getSettings } from "../api/client.js";
import { readConfig } from "../config.js";
import type { SettingsGroup, SettingEntry } from "../api/types.js";

interface ConfigEditorProps {
  onBack: () => void;
}

type EditState = { groupIdx: number; entryIdx: number; value: string } | null;

// ---------------------------------------------------------------------------

export function ConfigEditor({ onBack }: ConfigEditorProps) {
  const [groups, setGroups] = useState<SettingsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Cursor position
  const [cursorGroup, setCursorGroup] = useState(0);
  const [cursorEntry, setCursorEntry] = useState(0);

  // Inline edit state
  const [editing, setEditing] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  // Flat list of (groupIdx, entryIdx) for cursor navigation
  const flatRows: Array<{ gi: number; ei: number; entry: SettingEntry }> = [];
  groups.forEach((g, gi) =>
    g.entries.forEach((entry, ei) => flatRows.push({ gi, ei, entry })),
  );
  const cursorFlat = flatRows.findIndex(
    (r) => r.gi === cursorGroup && r.ei === cursorEntry,
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSettings();
      // Inject server config
      const cfg = readConfig();
      data.unshift({
        category: "Connection",
        entries: [
          { key: "base_url", label: "API URL", value: cfg.baseUrl ?? "—" },
          {
            key: "token",
            label: "Auth Token",
            value: cfg.token ? "••••••••" : "—",
          },
          { key: "username", label: "Username", value: cfg.username ?? "—" },
        ],
      });
      setGroups(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // -------------------------------------------------------------------
  // Keyboard navigation (only when not editing)
  // -------------------------------------------------------------------

  useInput((input, key) => {
    if (editing) {
      if (key.escape) setEditing(null);
      return;
    }

    if (input === "q" || key.escape) {
      onBack();
      return;
    }

    if (key.upArrow) {
      const next = Math.max(0, cursorFlat - 1);
      setCursorGroup(flatRows[next]?.gi ?? 0);
      setCursorEntry(flatRows[next]?.ei ?? 0);
      return;
    }

    if (key.downArrow) {
      const next = Math.min(flatRows.length - 1, cursorFlat + 1);
      setCursorGroup(flatRows[next]?.gi ?? 0);
      setCursorEntry(flatRows[next]?.ei ?? 0);
      return;
    }

    if (key.return) {
      const row = flatRows[cursorFlat];
      if (row) {
        setEditing({
          groupIdx: row.gi,
          entryIdx: row.ei,
          value:
            row.entry.value === "—" || row.entry.value === "••••••••"
              ? ""
              : row.entry.value,
        });
      }
    }

    if (input === "r") {
      loadSettings();
    }
  });

  // -------------------------------------------------------------------
  // Save an edited value
  // -------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!editing) return;
    const entry = groups[editing.groupIdx]?.entries[editing.entryIdx];
    if (!entry) return;

    setSaving(true);
    setSavedKey(null);
    try {
      const cfg = readConfig();

      if (entry.key === "base_url") {
        const { writeConfig } = await import("../config.js");
        writeConfig({ baseUrl: editing.value });
      } else if (entry.key === "token") {
        const { writeConfig } = await import("../config.js");
        writeConfig({ token: editing.value });
      } else if (entry.key === "username") {
        const { writeConfig } = await import("../config.js");
        writeConfig({ username: editing.value });
      } else {
        // Generic PATCH via /keys/create for LLM keys
        await fetch(`${cfg.baseUrl ?? "http://localhost:8000"}/keys/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.token ?? ""}`,
          },
          body: JSON.stringify({ provider: entry.key, key: editing.value }),
        });
      }

      // Update local state
      setGroups((prev) =>
        prev.map((g, gi) =>
          gi !== editing.groupIdx
            ? g
            : {
                ...g,
                entries: g.entries.map((e, ei) =>
                  ei !== editing.entryIdx ? e : { ...e, value: editing.value },
                ),
              },
        ),
      );

      setSavedKey(entry.key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (err) {
      // swallow — the user can retry
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }, [editing, groups]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  if (loading) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
        <Text color="cyan" bold>
          ⚙️ Config Editor
        </Text>
        <Box gap={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="cyan">Loading settings…</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
        <Text color="cyan" bold>
          ⚙️ Config Editor
        </Text>
        <Text color="red">✗ {error}</Text>
        <Text color="gray">
          Press <Text color="cyan">r</Text> to retry
        </Text>
        <Footer
          hints={[
            { key: "r", label: "retry" },
            { key: "q", label: "back" },
          ]}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="cyan" bold>
        ⚙️ Config Editor
      </Text>

      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
        marginTop={1}
        flexDirection="column">
        {groups.map((group, gi) => (
          <Box key={group.category} flexDirection="column" marginBottom={1}>
            <Text color="gray" bold dimColor>
              {group.category}
            </Text>
            <Text color="gray" dimColor>
              {"─".repeat(40)}
            </Text>

            {group.entries.map((entry, ei) => {
              const isCursor = gi === cursorGroup && ei === cursorEntry;
              const isEditing =
                editing?.groupIdx === gi && editing?.entryIdx === ei;
              const justSaved = savedKey === entry.key;

              return (
                <Box key={entry.key} gap={2} paddingLeft={2}>
                  <Text color={isCursor ? "cyan" : "gray"}>
                    {isCursor ? "▶" : " "}
                  </Text>
                  <Text color={isCursor ? "cyan" : "white"} bold={isCursor}>
                    {/* {entry.label.padEnd(22)} */}
                  </Text>

                  {isEditing ? (
                    <Box gap={1}>
                      <TextInput
                        value={editing.value}
                        onChange={(val) =>
                          setEditing((prev) =>
                            prev ? { ...prev, value: val } : prev,
                          )
                        }
                        onSubmit={handleSave}
                        focus
                      />
                      {saving && (
                        <Text color="cyan">
                          <Spinner type="dots" />
                        </Text>
                      )}
                    </Box>
                  ) : (
                    <Text color={justSaved ? "green" : "white"}>
                      {justSaved ? `✓ Saved` : entry.value}
                    </Text>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      <Footer
        hints={
          editing
            ? [
                { key: "Enter", label: "save" },
                { key: "Esc", label: "cancel" },
              ]
            : [
                { key: "↑↓", label: "navigate" },
                { key: "Enter", label: "edit value" },
                { key: "r", label: "reload" },
                { key: "q / Esc", label: "back" },
              ]
        }
      />
    </Box>
  );
}
