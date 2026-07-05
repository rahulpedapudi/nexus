import { useState, useCallback, useRef } from "react";
import open from "open";
import { readConfig, writeCredentials } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GoogleOAuthStatus =
  | "setup" // waiting for user to provide credentials file path
  | "waiting" // generating the auth URL
  | "open-browser" // URL ready, waiting for sign-in
  | "done" // connected successfully
  | "error"; // something went wrong

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Encapsulates Google OAuth SSE flow:
 *  1. User provides credentials file path ("setup")
 *  2. We call the backend, which streams an auth URL ("waiting" → "open-browser")
 *  3. We open the browser; backend streams a "done" event
 *  4. We persist the integration status
 */
export function useGoogleOAuth(onConnected: () => void) {
  const [googleAuthUrl, setGoogleAuthUrl] = useState("");
  const [googleOAuthStatus, setGoogleOAuthStatus] =
    useState<GoogleOAuthStatus>("setup");
  const [googleError, setGoogleError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const resetState = useCallback(() => {
    setGoogleAuthUrl("");
    setGoogleOAuthStatus("setup");
    setGoogleError("");
  }, []);

  const goToSetup = useCallback(() => {
    setGoogleOAuthStatus("setup");
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const startGoogleOAuth = useCallback(async () => {
    const cfg = readConfig();
    const base = cfg.baseUrl ?? "http://localhost:8000";
    const token = cfg.token ?? "";

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGoogleAuthUrl("");
    setGoogleOAuthStatus("waiting");
    setGoogleError("");

    try {
      const res = await fetch(`${base}/integrations/google/connect`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let event: { type: string; auth_url?: string; detail?: string };
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (event.type === "url" && event.auth_url) {
              setGoogleAuthUrl(event.auth_url);
              setGoogleOAuthStatus("open-browser");
              open(event.auth_url);
            } else if (event.type === "done") {
              setGoogleOAuthStatus("done");
              writeCredentials({ ENABLED_INTEGRATIONS: ["google"] });
              onConnected();
            } else if (event.type === "error") {
              setGoogleError(event.detail ?? "Unknown error");
              setGoogleOAuthStatus("error");
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setGoogleError(err instanceof Error ? err.message : String(err));
      setGoogleOAuthStatus("error");
    }
  }, [onConnected]);

  return {
    googleAuthUrl,
    googleOAuthStatus,
    googleError,
    startGoogleOAuth,
    goToSetup,
    resetState,
    abort,
  };
}
