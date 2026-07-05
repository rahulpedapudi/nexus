import fs from "fs";
import path from "path";
import os from "os";

// ---------------------------------------------------------------------------
// Config file location: ~/.nexus/cli-config.json
// ---------------------------------------------------------------------------

export interface NexusConfig {
  baseUrl: string;
  token: string;
  refreshToken?: string;
  username?: string;
}

// ---------------------------------------------------------------------------
// Credentials file location: ~/.nexus/credentials.json
// ---------------------------------------------------------------------------

export interface NexusCredentials {
  LLM_PROVIDER?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  EMBEDDING_MODEL?: string;
  GOOGLE_API_KEY?: string;
  ENABLED_GATEWAYS?: string[];
  ENABLED_INTEGRATIONS?: string[];

  telegram?: object;
  discord?: object;
}

/**
 * Resolves the Nexus data directory, in priority order:
 *   1. NEXUS_HOME env var (set by the install.sh launcher, or user-overridden)
 *   2. Windows  → %APPDATA%\nexus  (e.g. C:\Users\You\AppData\Roaming\nexus)
 *   3. macOS / Linux → ~/.nexus  (matches install.sh default)
 */
function getNexusHome(): string {
  const env = process.env["NEXUS_HOME"];
  if (env) return env;

  if (process.platform === "win32") {
    const appdata =
      process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appdata, "nexus");
  }

  // macOS and Linux both use ~/.nexus to stay consistent with install.sh
  return path.join(os.homedir(), ".nexus");
}

const CONFIG_DIR = getNexusHome();

const CONFIG_PATH = path.join(CONFIG_DIR, "cli-config.json");
const CREDS_PATH = path.join(CONFIG_DIR, "credentials.json");

export function readConfig(): Partial<NexusConfig> {
  // Environment variables take precedence
  const envBase = process.env["NEXUS_URL"];
  const envToken = process.env["NEXUS_TOKEN"];

  let fileConfig: Partial<NexusConfig> = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {
    // Ignore malformed config
  }

  return {
    ...fileConfig,
    ...(envBase ? { baseUrl: envBase } : {}),
    ...(envToken ? { token: envToken } : {}),
  };
}

export function writeConfig(cfg: Partial<NexusConfig>): void {
  const existing = readConfig();
  const merged = { ...existing, ...cfg };

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

export function readCredentials(): Partial<NexusCredentials> {
  let creds: Partial<NexusCredentials> = {};
  try {
    if (fs.existsSync(CREDS_PATH)) {
      creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf-8"));
    }
  } catch {
    // Ignore malformed creds
  }
  return creds;
}

export function writeCredentials(creds: Partial<NexusCredentials>): void {
  const existing = readCredentials();
  const merged = { ...existing, ...creds };

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CREDS_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

export function hasValidConfig(): boolean {
  const cfg = readConfig();
  return Boolean(cfg.baseUrl && cfg.token);
}

export function clearConfig(): void {
  if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
}

export function handleGoogleCreds(filePath: string) {
  if (!filePath.endsWith(".json")) {
    return;
  }

  if (!fs.existsSync(filePath)) {
    return;
  }

  let googleCreds;

  try {
    if (fs.existsSync(filePath)) {
      googleCreds = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
    // Ignore
  }

  const GOOGLE_CREDS_PATH = path.join(CONFIG_DIR, "google-credentials.json");

  fs.writeFileSync(GOOGLE_CREDS_PATH, JSON.stringify(googleCreds), "utf-8");
}
