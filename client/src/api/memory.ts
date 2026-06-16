import { api } from "./client";

// ── Types (matching backend MemoryResponse schema) ───────────────────

export interface MemoryItem {
  id: string;
  user_id: string;
  content: string;
  category: string;
  source: string;
  created_at: string;
  updated_at: string | null;
}

// ── API functions ────────────────────────────────────────────────────

export const memoryApi = {
  list: async (): Promise<MemoryItem[]> => {
    const res = await api.get<MemoryItem[]>("/memory/all");
    return res.data;
  },

  delete: async (memoryId: string): Promise<void> => {
    await api.delete(`/memory/${memoryId}`);
  },

  update: async (memoryId: string, content: string): Promise<MemoryItem> => {
    const res = await api.put<MemoryItem>(`/memory/${memoryId}`, null, {
      params: { new_content: content },
    });
    return res.data;
  },

  wipe: async (): Promise<void> => {
    await api.delete("/memory/wipe");
  },
};
