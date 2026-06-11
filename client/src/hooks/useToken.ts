import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth";

export const useToken = () => {
  return useQuery({
    queryKey: ["telegram"],
    queryFn: () => authApi.generateLinkToken(),
  });
};
