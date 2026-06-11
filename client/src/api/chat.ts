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

// ── API functions ────────────────────────────────────────────────────

export const chatApi = {
  sendMessage: async (data: MessageCreate): Promise<MessageResponse> => {
    const res = await api.post<MessageResponse>("/chat", data);
    return res.data;
  },
};
