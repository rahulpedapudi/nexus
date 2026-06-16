import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memoryApi, type MemoryItem } from "../api/memory";

export const MEMORIES_KEY = ["memories"] as const;

export function useMemories() {
  return useQuery<MemoryItem[]>({
    queryKey: MEMORIES_KEY,
    queryFn: () => memoryApi.list(),
    enabled: !!localStorage.getItem("access_token"),
    staleTime: 60_000,
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: string) => memoryApi.delete(memoryId),
    onSuccess: (_data, memoryId) => {
      qc.setQueryData<MemoryItem[]>(MEMORIES_KEY, (old = []) =>
        old.filter((m) => m.id !== memoryId),
      );
    },
  });
}

export function useUpdateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memoryId, content }: { memoryId: string; content: string }) =>
      memoryApi.update(memoryId, content),
    onSuccess: (updated) => {
      qc.setQueryData<MemoryItem[]>(MEMORIES_KEY, (old = []) =>
        old.map((m) => (m.id === updated.id ? updated : m)),
      );
    },
  });
}

export function useWipeMemories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => memoryApi.wipe(),
    onSuccess: () => {
      qc.setQueryData<MemoryItem[]>(MEMORIES_KEY, []);
    },
  });
}
