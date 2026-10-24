import fs from "node:fs";
import path from "node:path";

// Server-only. All config comes from the `.env` file in the project root and nothing else:
// shell/global env vars are deliberately ignored. A missing file means defaults (no AI keys -> fallback mode).

export type Config = {
  aiProviderOrder: string[];
  aiTimeoutMs: number;
  aiSearchTimeoutMs: number;
  geminiApiKey: string;
  geminiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  gcpProjectId: string;
  firestoreEnabled: boolean;
};

function parseEnv(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of src.replace(/^﻿/, "").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out[m[1]] = value;
  }
  return out;
}

let cache: { mtimeMs: number; values: Record<string, string> } | null = null;

function readEnvFile(): Record<string, string> {
  const file = path.join(process.cwd(), ".env");
  try {
    const { mtimeMs } = fs.statSync(file);
    if (cache?.mtimeMs !== mtimeMs) cache = { mtimeMs, values: parseEnv(fs.readFileSync(file, "utf8")) };
    return cache.values;
  } catch {
    return {};
  }
}

let override: Partial<Config> | null = null;

/** For scripts/tests only (e.g. check:fallback): force config values on top of `.env`. Pass null to clear. */
export function setConfigOverride(values: Partial<Config> | null) {
  override = values;
}

export function getConfig(): Config {
  const env = readEnvFile();
  const get = (key: string, fallback = "") => (env[key] ?? "").trim() || fallback;
  const timeout = Number(get("AI_TIMEOUT_MS"));
  const searchTimeout = Number(get("AI_SEARCH_TIMEOUT_MS"));
  return {
    aiProviderOrder: get("AI_PROVIDER_ORDER", "gemini,claude")
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean),
    aiTimeoutMs: Number.isFinite(timeout) && timeout >= 500 ? Math.min(timeout, 30_000) : 8000,
    aiSearchTimeoutMs: Number.isFinite(searchTimeout) && searchTimeout >= 2000 ? Math.min(searchTimeout, 60_000) : 20_000,
    geminiApiKey: get("GEMINI_API_KEY"),
    geminiModel: get("GEMINI_MODEL", "gemini-2.5-flash"),
    anthropicApiKey: get("ANTHROPIC_API_KEY"),
    anthropicModel: get("ANTHROPIC_MODEL", "claude-haiku-5-5"),
    gcpProjectId: get("GCP_PROJECT_ID"),
    firestoreEnabled: get("FIRESTORE_ENABLED", "false").toLowerCase() === "true",
    ...override,
  };
}
