import { api } from "./client";

// ── Types (matching backend Pydantic schemas) ────────────────────────

export interface MessageCreate {
  content: string;
}

export interface MessageResponse {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  source: "web" | "telegram";
  created_at: string;
  user_id: string;
}

// ── API functions ────────────────────────────────────────────────────

export const chatApi = {
  sendMessage: async (data: MessageCreate): Promise<MessageResponse> => {
    const res = await api.post<MessageResponse>("/chat", data);
    return res.data;
  },
};

export const conversationApi = {
  list: async (): Promise<ConversationSummary[]> => {
    const res = await api.get<ConversationSummary[]>("/conversations/");
    return res.data;
  },

  create: async (): Promise<ConversationSummary> => {
    const res = await api.post<ConversationSummary>("/conversations/");
    return res.data;
  },

  messages: async (convId: string): Promise<MessageResponse[]> => {
    const res = await api.get<MessageResponse[]>(`/conversations/${convId}/messages`);
    return res.data;
  },

  rename: async (convId: string, title: string): Promise<ConversationSummary> => {
    const res = await api.patch<ConversationSummary>(`/conversations/${convId}`, { title });
    return res.data;
  },

  delete: async (convId: string): Promise<void> => {
    await api.delete(`/conversations/${convId}`);
  },
};
