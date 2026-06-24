import fs from 'fs';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Config file location: ~/.nexus/cli-config.json
// ---------------------------------------------------------------------------

export interface NexusConfig {
  baseUrl: string;
  token: string;
  refreshToken?: string;
  username?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.nexus');
const CONFIG_PATH = path.join(CONFIG_DIR, 'cli-config.json');

export function readConfig(): Partial<NexusConfig> {
  // Environment variables take precedence
  const envBase = process.env['NEXUS_URL'];
  const envToken = process.env['NEXUS_TOKEN'];

  let fileConfig: Partial<NexusConfig> = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
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

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
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
