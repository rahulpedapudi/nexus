import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { toast } from "sonner";

async function createKey(key: string, provider: string) {
  const res = await api.post(`/keys/create`, {
    key,
    provider,
  });

  return res;
}

async function listKeys(): Promise<string[]> {
  const res = await api.get<string[]>("/keys/list");
  return res.data;
}

export function useCreateKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, provider }: { key: string; provider: string }) =>
      createKey(key, provider),
    onSuccess: () => {
      toast.success("Key saved successfully");
      // Refresh the list so Integrations screen picks up the new provider
      queryClient.invalidateQueries({ queryKey: ["keys", "list"] });
    },
    onError: (error: any) => {
      toast.error(error.response.data.detail);
    },
  });
}

export function useListKeys() {
  return useQuery({
    queryKey: ["keys", "list"],
    queryFn: listKeys,
    // Return empty array while loading so consumers don't need null checks
    placeholderData: [],
  });
}
