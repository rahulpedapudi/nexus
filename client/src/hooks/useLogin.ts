import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authApi, type LoginRequest, type TokenResponse } from "../api/auth";
import { AxiosError } from "axios";
import { toast } from "sonner";

export const useLogin = () => {
  const navigate = useNavigate();

  return useMutation<TokenResponse, AxiosError<{ detail: string }>, LoginRequest>({
    mutationFn: (data) => authApi.login(data),
    onSuccess: async (data) => {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      // Check if the user has completed onboarding (telegram linked)
      const user = await authApi.me();
      if (user.is_setup_complete) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
    },
    onError: (error) => {
      const message = error.response?.data?.detail ?? "Login failed. Please try again.";
      toast.error(message);
    },
  });
};
