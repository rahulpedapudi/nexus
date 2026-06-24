import { readConfig } from "../config";
import type {
  HealthResponse,
  TokenResponse,
  UserResponse,
  SetupRequest,
  KeyCreate,
  KeyResponse,
  MemoryResponse,
  TaskResponse,
  LogEntry,
  DashboardStats,
  SettingsGroup,
  ConversationResponse,
  MessageResponse,
  MessageCreate,
  StreamEvent,
} from "./types.js";

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function request<T>(
  path: string,
  options: RequestInit = {},
  baseUrlOverride?: string,
  tokenOverride?: string,
): Promise<T> {
  const cfg = readConfig();
  const base = baseUrlOverride ?? cfg.baseUrl ?? "http://localhost:8000";
  const token = tokenOverride ?? cfg.token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${base.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function pingHealth(
  baseUrl?: string,
): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await request<HealthResponse>("/health", {}, baseUrl);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

export async function getHealth(baseUrl?: string): Promise<HealthResponse> {
  return request<HealthResponse>("/health", {}, baseUrl);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function setupUser(
  data: SetupRequest,
  baseUrl?: string,
): Promise<UserResponse> {
  return request<UserResponse>(
    "/auth/setup",
    { method: "POST", body: JSON.stringify(data) },
    baseUrl,
  );
}

export async function login(
  username: string,
  password: string,
  baseUrl?: string,
): Promise<TokenResponse> {
  return request<TokenResponse>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ username, password }) },
    baseUrl,
  );
}

export async function getMe(): Promise<UserResponse> {
  return request<UserResponse>("/auth/me");
}

// ---------------------------------------------------------------------------
// Keys (LLM provider API keys)
// ---------------------------------------------------------------------------

export async function listKeys(): Promise<KeyResponse[]> {
  return request<KeyResponse[]>("/keys/list");
}

export async function createKey(data: KeyCreate): Promise<KeyResponse> {
  return request<KeyResponse>("/keys/create", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getKey(provider: string): Promise<KeyResponse> {
  return request<KeyResponse>(`/keys/get/${provider}`);
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export async function listMemories(): Promise<MemoryResponse[]> {
  return request<MemoryResponse[]>("/memory/all");
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listTasks(): Promise<TaskResponse[]> {
  return request<TaskResponse[]>("/task/all");
}

export async function searchTasks(params: {
  status?: string;
  done?: boolean;
  limit?: number;
}): Promise<TaskResponse[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.done !== undefined) qs.set("done", String(params.done));
  if (params.limit) qs.set("limit", String(params.limit));
  return request<TaskResponse[]>(`/task/search?${qs}`);
}

// ---------------------------------------------------------------------------
// Logs (synthetic — built from memory + task data as Nexus has no /logs route)
// ---------------------------------------------------------------------------

export async function getRecentLogs(limit = 15): Promise<LogEntry[]> {
  // Nexus doesn't expose a /logs endpoint yet, so we synthesize recent
  // activity from memories and tasks.
  const [memories, tasks] = await Promise.allSettled([
    listMemories(),
    listTasks(),
  ]);

  const entries: LogEntry[] = [];

  if (memories.status === "fulfilled") {
    memories.value.slice(0, Math.ceil(limit / 2)).forEach((m) => {
      entries.push({
        timestamp: m.created_at,
        level: "INFO",
        message: `Memory stored [${m.category}]: ${m.content.slice(0, 80)}`,
      });
    });
  }

  if (tasks.status === "fulfilled") {
    tasks.value.slice(0, Math.floor(limit / 2)).forEach((t) => {
      entries.push({
        timestamp: t.created_at,
        level: t.status === "done" ? "INFO" : "WARN",
        message: `Task [${t.priority}] ${t.status}: ${t.title}`,
      });
    });
  }

  return entries
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<DashboardStats> {
  const [memories, tasks] = await Promise.allSettled([
    listMemories(),
    searchTasks({ done: false }),
  ]);

  return {
    totalMemories: memories.status === "fulfilled" ? memories.value.length : 0,
    pendingTasks: tasks.status === "fulfilled" ? tasks.value.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Settings (keys-based config view)
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<SettingsGroup[]> {
  const keys = await listKeys();

  const keyGroup: SettingsGroup = {
    category: "LLM Keys",
    entries: keys.map((k) => ({
      key: `key_${k.provider}`,
      label: k.provider,
      value: "••••••••",
      description: `Added ${new Date(k.created_at).toLocaleDateString()}`,
    })),
  };

  if (keyGroup.entries.length === 0) {
    keyGroup.entries.push({
      key: "key_none",
      label: "No keys configured",
      value: "—",
    });
  }

  return [keyGroup];
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function listConversations(): Promise<ConversationResponse[]> {
  return request<ConversationResponse[]>("/conversations/");
}

export async function createConversation(): Promise<ConversationResponse> {
  return request<ConversationResponse>("/conversations/", {
    method: "POST",
    body: JSON.stringify({ source: "tui" }),
  });
}

export async function getMessages(convId: string): Promise<MessageResponse[]> {
  return request<MessageResponse[]>(`/conversations/${convId}/messages`);
}

export async function renameConversation(
  convId: string,
  title: string,
): Promise<ConversationResponse> {
  return request<ConversationResponse>(`/conversations/${convId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(convId: string): Promise<void> {
  return request<void>(`/conversations/${convId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Streaming chat via SSE  (POST /chat/stream)
// ---------------------------------------------------------------------------

/**
 * Opens an SSE connection to POST /chat/stream and yields parsed StreamEvents.
 * This is an async generator so the caller can process tokens as they arrive.
 */
export async function* streamChat(
  data: MessageCreate,
): AsyncGenerator<StreamEvent> {
  const cfg = readConfig();
  const base = cfg.baseUrl ?? "http://localhost:8000";
  const token = cfg.token;

  const res = await fetch(`${base.replace(/\/$/, "")}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {}
    yield { type: "error" as const, detail: `${res.status}: ${detail}` };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE lines are delimited by \n\n; each line starts with "data: "
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        yield JSON.parse(json) as StreamEvent;
      } catch {
        // malformed — skip
      }
    }
  }
}
