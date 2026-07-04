import React from "react";
import { Text } from "ink";
import SelectInput from "ink-select-input";

export interface MenuItem<T extends string = string> {
  label: string;
  value: T;
}

interface MenuSelectProps<T extends string = string> {
  items: MenuItem<T>[];
  onSelect: (item: MenuItem<T>) => void;
  /** Indicator color when item is selected. Defaults to "cyan". */
  indicatorColor?: string;
}

/**
 * A thin wrapper around SelectInput that applies the standard Nexus TUI
 * styling: a "▶ " cyan indicator and cyan/white item text.
 */
export function MenuSelect<T extends string = string>({
  items,
  onSelect,
  indicatorColor = "cyan",
}: MenuSelectProps<T>) {
  return (
    <SelectInput
      items={items}
      onSelect={onSelect as (item: { label: string; value: string }) => void}
      indicatorComponent={({ isSelected }) => (
        <Text color={indicatorColor}>{isSelected ? "▶ " : "  "}</Text>
      )}
      itemComponent={({ isSelected, label }) => (
        <Text color={isSelected ? indicatorColor : "white"} bold={isSelected}>
          {label}
        </Text>
      )}
    />
  );
}
