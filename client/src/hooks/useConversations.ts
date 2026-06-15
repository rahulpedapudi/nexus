import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationApi, type ConversationSummary } from "../api/chat";

export const CONVERSATIONS_KEY = ["conversations"] as const;

export function useConversations() {
  return useQuery<ConversationSummary[]>({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => conversationApi.list(),
    enabled: !!localStorage.getItem("access_token"),
    staleTime: 30_000,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => conversationApi.create(),
    onSuccess: (newConv) => {
      qc.setQueryData<ConversationSummary[]>(CONVERSATIONS_KEY, (old = []) => [
        newConv,
        ...old,
      ]);
    },
  });
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ convId, title }: { convId: string; title: string }) =>
      conversationApi.rename(convId, title),
    onSuccess: (updated) => {
      qc.setQueryData<ConversationSummary[]>(CONVERSATIONS_KEY, (old = []) =>
        old.map((c) => (c.id === updated.id ? updated : c)),
      );
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convId: string) => conversationApi.delete(convId),
    onSuccess: (_data, convId) => {
      qc.setQueryData<ConversationSummary[]>(CONVERSATIONS_KEY, (old = []) =>
        old.filter((c) => c.id !== convId),
      );
    },
  });
}
