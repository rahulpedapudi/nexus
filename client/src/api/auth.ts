import { api } from "./client";

// ── Types (matching backend Pydantic schemas) ────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface SetupRequest {
  email: string;
  username: string;
  password: string;
}

export interface UserResponse {
  username: string;
  email: string;
  is_setup_complete: boolean;
  created_at: string;
}

export interface LinkTokenResponse {
  token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

// ── API functions ────────────────────────────────────────────────────

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const res = await api.post<TokenResponse>("/auth/login", data);
    return res.data;
  },

  setup: async (data: SetupRequest): Promise<UserResponse> => {
    const res = await api.post<UserResponse>("/auth/setup", data);
    return res.data;
  },

  refresh: async (data: RefreshRequest): Promise<TokenResponse> => {
    const res = await api.post<TokenResponse>("/auth/refresh", data);
    return res.data;
  },

  me: async (): Promise<UserResponse> => {
    const res = await api.get<UserResponse>("/auth/me");
    return res.data;
  },

  generateLinkToken: async (): Promise<LinkTokenResponse> => {
    const res = await api.post<LinkTokenResponse>("/auth/generate-link-token");
    return res.data;
  },

  linkTelegram: async (token: string, telegramId: string): Promise<void> => {
    await api.post("/auth/link-telegram", null, {
      params: { token, telegram_id: telegramId },
    });
  },
};
