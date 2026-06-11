import axios from "axios";

// const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const BASE_URL = "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
});

// Attach the access token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 responses, clear stored tokens and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      // Only redirect if we're not already on an auth page
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/setup") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
