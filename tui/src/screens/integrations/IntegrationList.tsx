import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";

import { StatusDot } from "../../components/StatusDot.js";
import type { Integration } from "../../api/types.js";

interface IntegrationListProps {
  integrations: Integration[];
  loading: boolean;
  onSelect: (intg: Integration) => void;
}

export function IntegrationList({
  integrations,
  loading,
  onSelect,
}: IntegrationListProps) {
  if (loading) {
    return (
      <Box gap={1}>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text color="cyan">Loading integrations…</Text>
      </Box>
    );
  }

  const items = integrations.map((intg) => ({
    label: intg.displayName,
    value: intg.name,
  }));

  return (
    <Box flexDirection="column">
      <SelectInput
        items={items}
        onSelect={(item) => {
          const intg = integrations.find((i) => i.name === item.value)!;
          onSelect(intg);
        }}
        indicatorComponent={() => null}
        itemComponent={({ isSelected, label }) => {
          const intg = integrations.find((i) => i.displayName === label)!;
          const index = integrations.findIndex((i) => i.name === intg.name);
          const isFirstInCategory =
            index === 0 ||
            integrations[index - 1]?.category !== intg.category;

          return (
            <Box flexDirection="column">
              {isFirstInCategory && (
                <Box paddingBottom={1} paddingTop={index === 0 ? 0 : 1}>
                  <Text color="magenta" bold>
                    {intg.category}
                  </Text>
                </Box>
              )}
              <Box flexDirection="row">
                <Box width={2}>
                  <Text color="cyan">{isSelected ? "▶ " : "  "}</Text>
                </Box>
                <Box gap={2}>
                  <StatusDot connected={intg?.connected ?? false} />
                  <Text
                    color={isSelected ? "cyan" : "white"}
                    bold={isSelected}
                  >
                    {label.padEnd(22)}
                  </Text>
                  <Text
                    color={intg?.connected ? "green" : "gray"}
                    dimColor={!intg?.connected}
                  >
                    {(intg?.connected ? "connected" : "not set up").padEnd(12)}
                  </Text>
                  <Text color="cyan" dimColor>
                    {intg?.connected ? "[Reconfigure]" : "[Connect]"}
                  </Text>
                </Box>
              </Box>
            </Box>
          );
        }}
      />
    </Box>
  );
}
