// Slash command definitions shared across Chat components

export interface SlashCommand {
  trigger: string;
  label: string;
  description: string;
}

export const COMMANDS: SlashCommand[] = [
  {
    trigger: "/new",
    label: "New conversation",
    description: "Start a fresh conversation",
  },
  {
    trigger: "/rename",
    label: "Rename",
    description: "Rename: /rename My New Title",
  },
  {
    trigger: "/delete",
    label: "Delete",
    description: "Delete this conversation",
  },
  {
    trigger: "/menu",
    label: "Main menu",
    description: "Navigate to the main menu",
  },
  {
    trigger: "/provider",
    label: "LLM Provider",
    description: "Change LLM provider",
  },
  { trigger: "/help", label: "Help", description: "List all slash commands" },
  {
    trigger: "/conversation",
    label: "Search conversations",
    description: "Search and switch conversations",
  },
];

export function filterCommands(input: string): SlashCommand[] {
  if (!input.startsWith("/")) return [];
  const query = input.split(" ")[0]!.slice(1).toLowerCase();
  if (query === "") return COMMANDS;
  return COMMANDS.filter((c) => c.trigger.slice(1).startsWith(query));
}

export function matchExact(input: string): SlashCommand | null {
  const trigger = input.trim().split(" ")[0]!;
  return COMMANDS.find((c) => c.trigger === trigger) ?? null;
}
