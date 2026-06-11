import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authApi, type SetupRequest, type UserResponse } from "../api/auth";
import { AxiosError } from "axios";
import { toast } from "sonner";

export const useSetup = () => {
  const navigate = useNavigate();

  return useMutation<UserResponse, AxiosError<{ detail: string }>, SetupRequest>({
    mutationFn: (data) => authApi.setup(data),
    onSuccess: () => {
      toast.success("Account created! Please log in.");
      navigate("/login");
    },
    onError: (error) => {
      const message = error.response?.data?.detail ?? "Setup failed. Please try again.";
      toast.error(message);
    },
  });
};
