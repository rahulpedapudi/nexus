import { useMutation } from "@tanstack/react-query";
import { chatApi, type MessageCreate, type MessageResponse } from "../api/chat";
import { AxiosError } from "axios";
import { toast } from "sonner";

export const useChat = () => {
  return useMutation<MessageResponse, AxiosError<{ detail: string }>, MessageCreate>({
    mutationFn: (data) => chatApi.sendMessage(data),
    onError: (error) => {
      const message = error.response?.data?.detail ?? "Failed to send message.";
      toast.error(message);
    },
  });
};
