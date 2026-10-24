import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { getConfig, type Config } from "./config";
import type { Mode } from "./types";

// Server-only. Tries providers in AI_PROVIDER_ORDER; skips a provider with no key; any error
// (HTTP 4xx/5xx, timeout, bad JSON, schema mismatch) moves on to the next. Never retries, never throws.

export type Provider = Exclude<Mode, "fallback">;
export type AiResult<T> = { data: T; provider: Provider };

type Call = (prompt: string, cfg: Config, signal: AbortSignal) => Promise<string>;

async function callGemini(prompt: string, cfg: Config, signal: AbortSignal): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": cfg.geminiApiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      signal,
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("empty response");
  return text;
}

async function callClaude(prompt: string, cfg: Config, signal: AbortSignal): Promise<string> {
  // Explicit apiKey + baseURL so nothing is picked up from shell env vars.
  const client = new Anthropic({
    apiKey: cfg.anthropicApiKey,
    baseURL: "https://api.anthropic.com",
    maxRetries: 0,
  });
  const msg = await client.messages.create(
    {
      model: cfg.anthropicModel,
      max_tokens: 4096,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    },
    { signal, timeout: cfg.aiTimeoutMs },
  );
  if (msg.stop_reason === "refusal") throw new Error("refused");
  return msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
}

const PROVIDERS: Record<Provider, { key: (c: Config) => string; call: Call }> = {
  gemini: { key: (c) => c.geminiApiKey, call: callGemini },
  claude: { key: (c) => c.anthropicApiKey, call: callClaude },
};

function parseJSON(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "");
  try {
    return JSON.parse(text);
  } catch {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a < 0 || b <= a) throw new Error("no JSON in response");
    return JSON.parse(text.slice(a, b + 1));
  }
}

function describe(err: unknown, cfg: Config): string {
  let msg: string;
  if (err instanceof Anthropic.APIError && err.status) msg = `HTTP ${err.status}`;
  else if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) msg = "timeout";
  else msg = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
  for (const key of [cfg.geminiApiKey, cfg.anthropicApiKey]) {
    if (key) msg = msg.split(key).join("***");
  }
  return msg.slice(0, 160);
}

export async function generateJSON<T>(
  prompt: string,
  schema: z.ZodType<T>,
): Promise<AiResult<T> | null> {
  let cfg: Config | null = null;
  try {
    cfg = getConfig();
    const order = cfg.aiProviderOrder.filter(
      (name, i, all): name is Provider => Object.hasOwn(PROVIDERS, name) && all.indexOf(name) === i,
    );
    for (const name of order) {
      const provider = PROVIDERS[name];
      if (!provider.key(cfg).trim()) continue; // no key -> skip
      try {
        const raw = await provider.call(prompt, cfg, AbortSignal.timeout(cfg.aiTimeoutMs));
        const parsed = schema.safeParse(parseJSON(raw));
        if (parsed.success) return { data: parsed.data, provider: name };
        console.warn(`[ai] ${name}: response failed validation`);
      } catch (err) {
        console.warn(`[ai] ${name} failed: ${describe(err, cfg)}`);
      }
    }
  } catch (err) {
    console.warn(`[ai] unexpected error: ${cfg ? describe(err, cfg) : "config failed"}`);
  }
  return null;
}
