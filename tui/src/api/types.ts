// API response types mirroring the Nexus backend schemas

export interface HealthResponse {
  status: "ok" | "error";
  database?: string;
  uptime?: number;
  version?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface SetupRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface KeyCreate {
  provider: string;
  key: string;
}

export interface KeyResponse {
  id: string;
  provider: string;
  created_at: string;
}

export interface MemoryResponse {
  id: string;
  content: string;
  category: string;
  source: string;
  created_at: string;
}

export interface TaskResponse {
  id: string;
  title: string;
  status: string;
  priority: string;
  done: boolean;
  due_at?: string;
  remind_at?: string;
  tags?: string[];
  note?: string;
  created_at: string;
}

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
}

export interface DashboardStats {
  totalMemories: number;
  pendingTasks: number;
  uptime?: number;
}

export interface Integration {
  name: string;
  category: "Gateways" | "Integrations";
  displayName: string;
  connected: boolean;
  connectedAt?: string;
  fields: IntegrationField[];
}

export interface IntegrationField {
  key: string;
  label: string;
  placeholder: string;
  masked: boolean;
}

export interface SettingsGroup {
  category: string;
  entries: SettingEntry[];
}

export interface SettingEntry {
  key: string;
  masked?: boolean;
  label: string;
  value: string;
  description?: string;
}

export type Screen =
  | "chat"
  | "main-menu"
  | "setup-wizard"
  // | "dashboard"
  | "integrations"
  | "config-editor";

// ---------------------------------------------------------------------------
// Chat / Conversations
// ---------------------------------------------------------------------------

export interface ConversationResponse {
  id: string;
  title: string | null;
  created_at: string;
  user_id: string;
  source: string;
}

export interface MessageResponse {
  id: string;
  conv_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  source: string;
  created_at: string;
}

export interface MessageCreate {
  content: string;
  source: "tui";
  conv_id?: string;
}

// SSE stream events from POST /chat/stream
export type StreamEvent =
  | { type: "status"; phase: "thinking" | "streaming" | "done" }
  | { type: "delta"; text: string }
  | { type: "done"; message_id: string; conv_id: string; full_text: string }
  | { type: "error"; detail: string; code?: string };
