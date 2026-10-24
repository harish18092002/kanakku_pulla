import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { getConfig, type Config } from "./config";
import type { Mode, SearchInfo } from "./types";

// Server-only. Tries providers in AI_PROVIDER_ORDER; skips a provider with no key; any error
// (HTTP 4xx/5xx, timeout, bad JSON, schema mismatch) moves on. Never throws, never retries a request.
// With `search: true`, Gemini first tries Google Search grounding (live web results), then plain JSON mode.

export type Provider = Exclude<Mode, "fallback">;
export type AiResult<T> = { data: T; provider: Provider; search: SearchInfo | null };
export type GenerateOptions = { search?: boolean };

type Reply = { text: string; search?: SearchInfo };
type Call = (prompt: string, cfg: Config, signal: AbortSignal, search: boolean) => Promise<Reply>;

type Grounding = {
  webSearchQueries?: unknown[];
  groundingChunks?: { web?: { uri?: string; title?: string } }[];
};

// Grounding metadata comes from the open web: keep only short strings and https links.
function toSearchInfo(meta?: Grounding): SearchInfo {
  const queries = (meta?.webSearchQueries ?? [])
    .filter((q): q is string => typeof q === "string" && q.length > 0)
    .map((q) => q.slice(0, 150))
    .slice(0, 6);
  const seen = new Set<string>();
  const sources: SearchInfo["sources"] = [];
  for (const chunk of meta?.groundingChunks ?? []) {
    const url = chunk.web?.uri ?? "";
    if (!/^https:\/\//.test(url) || url.length > 600 || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: (chunk.web?.title || "Source").slice(0, 100), url });
    if (sources.length === 6) break;
  }
  return { queries, sources };
}

async function callGemini(prompt: string, cfg: Config, signal: AbortSignal, search: boolean): Promise<Reply> {
  // 2.5-flash "thinks" before answering, which only adds seconds to a structured-JSON task.
  const thinking = /^gemini-2\.5-flash/.test(cfg.geminiModel) ? { thinkingConfig: { thinkingBudget: 0 } } : {};
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": cfg.geminiApiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // Gemini can't combine Google Search with JSON mode, so a search call asks for JSON in the prompt.
        generationConfig: search
          ? { temperature: 0.2, ...thinking }
          : { responseMimeType: "application/json", temperature: 0.2, ...thinking },
        ...(search ? { tools: [{ google_search: {} }] } : {}),
      }),
      signal,
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: Grounding }[];
  };
  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("empty response");
  return { text, search: search ? toSearchInfo(candidate?.groundingMetadata) : undefined };
}

async function callClaude(prompt: string, cfg: Config, signal: AbortSignal): Promise<Reply> {
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
  return { text: msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("") };
}

const PROVIDERS: Record<Provider, { key: (c: Config) => string; call: Call; canSearch: boolean }> = {
  gemini: { key: (c) => c.geminiApiKey, call: callGemini, canSearch: true },
  claude: { key: (c) => c.anthropicApiKey, call: callClaude, canSearch: false },
};

// Tolerant of code fences, text around the object, and trailing commas (common when JSON mode is off).
function parseJSON(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "");
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  for (const candidate of a >= 0 && b > a ? [text, text.slice(a, b + 1)] : [text]) {
    for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        return JSON.parse(attempt);
      } catch {
        // try the next, more lenient form
      }
    }
  }
  throw new Error("no valid JSON in response");
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
  options: GenerateOptions = {},
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
      // A failed search attempt degrades to the same provider's plain attempt before moving on.
      for (const search of options.search && provider.canSearch ? [true, false] : [false]) {
        const label = search ? `${name}+search` : name;
        try {
          const timeout = search ? cfg.aiSearchTimeoutMs : cfg.aiTimeoutMs;
          const reply = await provider.call(prompt, cfg, AbortSignal.timeout(timeout), search);
          const parsed = schema.safeParse(parseJSON(reply.text));
          if (parsed.success) {
            const found = reply.search && (reply.search.queries.length || reply.search.sources.length);
            return { data: parsed.data, provider: name, search: found ? reply.search! : null };
          }
          console.warn(`[ai] ${label}: response failed validation`);
        } catch (err) {
          console.warn(`[ai] ${label} failed: ${describe(err, cfg)}`);
        }
      }
    }
  } catch (err) {
    console.warn(`[ai] unexpected error: ${cfg ? describe(err, cfg) : "config failed"}`);
  }
  return null;
}
