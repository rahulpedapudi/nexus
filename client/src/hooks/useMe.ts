import { useQuery } from "@tanstack/react-query";
import { authApi, type UserResponse } from "../api/auth";
import { AxiosError } from "axios";

export const useMe = () => {
  return useQuery<UserResponse, AxiosError<{ detail: string }>>({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me(),
    // Only attempt if we have a token stored
    enabled: !!localStorage.getItem("access_token"),
  });
};
