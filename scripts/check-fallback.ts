// npm run check:fallback — proves /api/compile, /api/agent and /api/authorize never fail and keep one
// response shape with empty keys, fake keys, and failing/odd providers. Exits 1 if anything breaks.
import assert from "node:assert/strict";
import { POST as agent } from "../app/api/agent/route";
import { POST as authorize } from "../app/api/authorize/route";
import { POST as compile } from "../app/api/compile/route";
import { setConfigOverride } from "../lib/config";
import { emptyState, recordSpend } from "../lib/engine";
import { PaymentRequestSchema } from "../lib/types";
import type { Decision, PaymentRequest, Policy, Rule, WalletState } from "../lib/types";

type Reply = {
  mode?: string;
  store?: string;
  policy?: Policy;
  warnings?: string[];
  requests?: PaymentRequest[];
  decision?: Decision;
};
type Handler = (req: Request) => Promise<Response>;

const FAKE_GEMINI = "fake-gemini-key-0000";
const FAKE_CLAUDE = "sk-ant-fake-key-0000";
const NO_KEYS = { geminiApiKey: "", anthropicApiKey: "" };

let failed = 0;
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(err instanceof Error ? err.message : String(err)).slice(0, 500)}`);
  }
}

async function post(handler: Handler, body: unknown): Promise<{ status: number; json: Reply }> {
  const res = await handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as Reply };
}

const sig = (r: Rule) =>
  [r.type, ...(Object.keys(r.params).length ? [Object.values(r.params).join("-")] : []), r.action].join(":");
const MODES = ["gemini", "claude", "fallback"];
const STORES = ["firestore", "local"];

function assertShape(res: { status: number; json: Reply }) {
  assert.equal(res.status, 200);
  assert.ok(MODES.includes(res.json.mode ?? ""), `bad mode ${res.json.mode}`);
  assert.ok(STORES.includes(res.json.store ?? ""), `bad store ${res.json.store}`);
}

async function compileSigs(text: string) {
  const res = await post(compile, { text });
  assertShape(res);
  return { res, sigs: (res.json.policy?.rules ?? []).map(sig) };
}

async function agentRequests(task: string) {
  const res = await post(agent, { task });
  assertShape(res);
  const requests = res.json.requests ?? [];
  assert.ok(requests.length >= 3 && requests.length <= 6, `expected 3-6 requests, got ${requests.length}`);
  for (const r of requests) PaymentRequestSchema.parse(r);
  return { res, requests };
}

const PHRASES: [string, string[]][] = [
  ["Never pay more than ₹2,000 in a single payment", ["max_per_txn:2000:block"]],
  ["Ask me before paying anything above Rs. 1500", ["ask_above:1500:ask"]],
  ["Ask me for anything over ₹3,000", ["ask_above:3000:ask"]],
  ["Don't spend more than 5k a day", ["daily_total_cap:5000:block"]],
  ["Daily limit 1.5 lakh", ["daily_total_cap:150000:block"]],
  ["Food limit ₹800 per day", ["category_daily_cap:food-800:block"]],
  ["No more than ₹500 on entertainment per day", ["category_daily_cap:entertainment-500:block"]],
  ["Block gambling and crypto", ["blocked_category:gambling:block", "blocked_category:crypto:block"]],
  ["Ask me before paying new merchants", ["new_merchant:ask"]],
  ["Never pay to Dream11", ["blocked_merchant:Dream11:block"]],
  ["Block Swiggy and Zomato", ["blocked_merchant:Swiggy:block", "blocked_merchant:Zomato:block"]],
  ["No payments between 11pm and 6am", ["time_window:23-6:block"]],
  ["Only allow payments between 9am and 9pm", ["time_window:21-9:block"]],
  ["Don't allow food orders after 10pm", ["time_window:22-6:block"]],
  ["Max ₹2000 per payment and ₹10,000 per day", ["max_per_txn:2000:block", "daily_total_cap:10000:block"]],
];

const DEMO_POLICY = [
  "Never pay more than ₹5,000 in one payment.",
  "Ask me for anything above ₹1,000.",
  "Max ₹3,000 per day on food.",
  "Block gambling and crypto.",
  "Ask me before paying new merchants.",
].join(" ");
const DEMO_SIGS = [
  "max_per_txn:5000:block",
  "ask_above:1000:ask",
  "category_daily_cap:food-3000:block",
  "blocked_category:gambling:block",
  "blocked_category:crypto:block",
  "new_merchant:ask",
];

async function oddInputs() {
  for (const handler of [compile, agent, authorize]) {
    for (const body of ["{not json", "", "[]", '{"text":42,"task":{},"request":"x","policy":7}']) {
      assertShape(await post(handler, body));
    }
  }
  const bad = await post(authorize, "{not json");
  assert.equal(bad.json.decision?.status, "block", "unreadable authorize input must fail closed");
  const empty = await compileSigs("   ");
  assert.deepEqual(empty.sigs, []);
}

async function compileAndAgent(label: string, full: boolean) {
  await step(`${label}: compile demo policy -> fallback, rules + source sentences`, async () => {
    const { res, sigs } = await compileSigs(DEMO_POLICY);
    assert.equal(res.json.mode, "fallback");
    assert.deepEqual(sigs, DEMO_SIGS);
    const rules = res.json.policy?.rules ?? [];
    assert.equal(new Set(rules.map((r) => r.id)).size, rules.length, "rule ids must be unique");
    assert.equal(rules[0].source, "Never pay more than ₹5,000 in one payment.");
    assert.equal(rules[3].source, "Block gambling and crypto.");
    assert.equal(rules[5].source, "Ask me before paying new merchants.");
  });
  await step(`${label}: agent -> 3-6 valid requests (mixed + task-specific)`, async () => {
    for (const task of ["", "order dinner for the team", "plan a trip to Goa"]) {
      const { res } = await agentRequests(task);
      assert.equal(res.json.mode, "fallback");
    }
  });
  if (!full) return;
  await step(`${label}: ${PHRASES.length} common phrasings parse correctly`, async () => {
    const wrong: string[] = [];
    for (const [text, expected] of PHRASES) {
      const { res, sigs } = await compileSigs(text);
      assert.equal(res.json.mode, "fallback");
      if (JSON.stringify(sigs) !== JSON.stringify(expected)) wrong.push(`"${text}" -> ${JSON.stringify(sigs)}`);
    }
    assert.deepEqual(wrong, []);
  });
  await step(`${label}: unparseable text warns instead of failing`, async () => {
    const { res, sigs } = await compileSigs("I love chai.");
    assert.deepEqual(sigs, []);
    assert.ok((res.json.warnings ?? []).length >= 1);
  });
  await step(`${label}: odd/malformed bodies still return 200 + mode + store`, oddInputs);
}

async function engineChecks() {
  const baseReq = (o: Partial<PaymentRequest> = {}): PaymentRequest => ({
    id: "t1", merchant: "Swiggy", vpa: "swiggy@icici", amount: 300, category: "food",
    purpose: "test", timestamp: "2026-10-24T06:30:00Z", ...o, // 12:00 IST
  });
  const decide = async (policy: Policy | undefined, state: WalletState | undefined, request: PaymentRequest) => {
    const res = await post(authorize, { policy, state, request });
    assertShape(res);
    return res.json.decision as Decision;
  };

  await step("authorize: daily cap accumulates, resets next IST day, gambling + night blocked", async () => {
    const { res } = await compileSigs("Don't spend more than 1000 a day. Block gambling. No payments after 11pm.");
    const policy = res.json.policy;
    let state = emptyState();
    assert.equal((await decide(policy, state, baseReq({ amount: 600 }))).status, "approve");
    state = recordSpend(state, baseReq({ amount: 600 }));
    const over = await decide(policy, state, baseReq({ id: "t2", amount: 600 }));
    assert.deepEqual([over.status, over.ruleIds], ["block", ["r1"]]);
    const tomorrow = baseReq({ id: "t3", amount: 600, timestamp: "2026-10-25T06:30:00Z" });
    assert.equal((await decide(policy, state, tomorrow)).status, "approve");
    assert.equal((await decide(policy, emptyState(), baseReq({ category: "gambling" }))).status, "block");
    const night = baseReq({ timestamp: "2026-10-24T20:00:00Z" }); // 01:30 IST
    assert.equal((await decide(policy, emptyState(), night)).status, "block");
  });

  await step("authorize: BLOCK > ASK > APPROVE", async () => {
    const { res } = await compileSigs("Ask me for anything above 500. Never pay more than 2000.");
    const policy = res.json.policy;
    assert.equal((await decide(policy, undefined, baseReq({ amount: 100 }))).status, "approve");
    assert.equal((await decide(policy, undefined, baseReq({ amount: 800 }))).status, "ask");
    const blocked = await decide(policy, undefined, baseReq({ amount: 2500 }));
    assert.deepEqual([blocked.status, blocked.ruleIds], ["block", ["r2"]]);
  });

  await step("authorize: fails closed on missing/invalid policy or request", async () => {
    assert.equal((await decide(undefined, undefined, baseReq())).status, "block");
    assert.equal((await decide({ rules: [], text: "" }, undefined, { ...baseReq(), amount: -5 })).status, "block");
    assert.equal((await decide({ rules: [], text: "" }, undefined, baseReq())).status, "approve");
  });

  await step("compile -> agent -> authorize end to end (all three outcomes)", async () => {
    const { res } = await compileSigs(DEMO_POLICY);
    const { requests } = await agentRequests("");
    let state: WalletState = { ...emptyState(), knownMerchants: ["swiggy@icici", "uber@axisbank", "netflix@hdfcbank"] };
    const statuses: string[] = [];
    for (const request of requests) {
      const d = await decide(res.json.policy, state, request);
      statuses.push(d.status);
      console.log(`      ${d.status.padEnd(7)} ₹${String(request.amount).padStart(5)}  ${request.merchant.padEnd(11)} ${d.reasons[0]}`);
      if (d.status === "approve") state = recordSpend(state, request);
    }
    assert.deepEqual(statuses, ["approve", "approve", "ask", "approve", "block", "block"]);
  });
}

// ---------- scenarios that need provider stubs ----------

const realFetch = globalThis.fetch;
const urlOf = (input: Parameters<typeof fetch>[0]) =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const calls: string[] = [];
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = urlOf(input);
    calls.push(new URL(url).host);
    return Promise.resolve(handler(url, init));
  }) as typeof fetch;
  return calls;
}

const geminiOk = (payload: unknown, fence = false) => {
  const text = JSON.stringify(payload);
  return Response.json({ candidates: [{ content: { parts: [{ text: fence ? `\`\`\`json\n${text}\n\`\`\`` : text }] } }] });
};
const claudeOk = (payload: unknown) =>
  Response.json({
    id: "msg_test", type: "message", role: "assistant", model: "claude-haiku-5-5",
    content: [{ type: "text", text: JSON.stringify(payload) }],
    stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  });
const isGemini = (url: string) => url.includes("generativelanguage.googleapis.com");

const AI_RULES = { rules: [{ type: "max_per_txn", params: { amount: 999.4 }, action: "block", source: "cap it" }] };
const AI_REQUESTS = {
  requests: [
    { merchant: "Zepto", vpa: "zepto@icici", amount: 312.6, category: "Food", purpose: "Milk and eggs" },
    { merchant: "Ola", vpa: "ola@axisbank", amount: 240, category: "travel", purpose: "Cab home" },
    { merchant: "Spotify", vpa: "spotify@hdfcbank", amount: 119, category: "subscriptions", purpose: "Premium" },
  ],
};

async function providerChain() {
  const gemini = { ...NO_KEYS, geminiApiKey: FAKE_GEMINI, aiProviderOrder: ["gemini", "claude"], aiTimeoutMs: 5000 };
  const both = { ...gemini, anthropicApiKey: FAKE_CLAUDE };

  await step("gemini ok (JSON mode, fenced or plain) -> mode gemini, values normalised", async () => {
    setConfigOverride(gemini);
    for (const fence of [false, true]) {
      stubFetch(() => geminiOk(AI_RULES, fence));
      const { res, sigs } = await compileSigs("cap payments at 999");
      assert.equal(res.json.mode, "gemini");
      assert.deepEqual(sigs, ["max_per_txn:999:block"]);
      assert.equal(res.json.policy?.rules[0].source, "cap it");
      assert.equal(res.json.policy?.rules[0].id, "r1");
    }
    stubFetch(() => geminiOk(AI_REQUESTS));
    const { res, requests } = await agentRequests("groceries");
    assert.equal(res.json.mode, "gemini");
    assert.deepEqual([requests[0].amount, requests[0].category], [313, "food"]);
  });

  await step("gemini returns schema-invalid / too-few / garbage JSON -> fallback", async () => {
    setConfigOverride(gemini);
    stubFetch(() => geminiOk({ rules: [{ type: "nope" }] }));
    assert.equal((await compileSigs("Block gambling")).res.json.mode, "fallback");
    stubFetch(() => geminiOk({ requests: AI_REQUESTS.requests.slice(0, 2) }));
    assert.equal((await agentRequests("groceries")).res.json.mode, "fallback");
    stubFetch(() => Response.json({ candidates: [{ content: { parts: [{ text: "sorry, no JSON here" }] } }] }));
    assert.equal((await compileSigs("Block gambling")).sigs[0], "blocked_category:gambling:block");
  });

  await step("HTTP 429 / 500 / network error -> fallback, no retry", async () => {
    setConfigOverride(gemini);
    for (const handler of [
      () => new Response("rate limited", { status: 429 }),
      () => new Response("boom", { status: 500 }),
      () => { throw new TypeError("fetch failed"); },
    ]) {
      const calls = stubFetch(handler);
      assert.equal((await compileSigs("Block gambling")).res.json.mode, "fallback");
      assert.equal(calls.length, 1, "a failing provider must not be retried");
    }
  });

  await step("hung provider is cut off by AI_TIMEOUT_MS -> fallback", async () => {
    setConfigOverride({ ...both, aiTimeoutMs: 400 });
    stubFetch((_url, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const started = Date.now();
    assert.equal((await agentRequests("dinner")).res.json.mode, "fallback");
    assert.ok(Date.now() - started < 3000, `took ${Date.now() - started}ms`);
  });

  await step("AI_PROVIDER_ORDER is respected; failure moves on to the next provider", async () => {
    setConfigOverride({ ...both, aiProviderOrder: ["claude", "gemini"] });
    let calls = stubFetch(() => new Response("down", { status: 503 }));
    assert.equal((await compileSigs("Block gambling")).res.json.mode, "fallback");
    assert.deepEqual(calls, ["api.anthropic.com", "generativelanguage.googleapis.com"]);

    setConfigOverride(both);
    calls = stubFetch((url) => (isGemini(url) ? new Response("down", { status: 500 }) : claudeOk(AI_RULES)));
    assert.equal((await compileSigs("cap payments at 999")).res.json.mode, "claude");
    assert.deepEqual(calls, ["generativelanguage.googleapis.com", "api.anthropic.com"]);

    setConfigOverride({ ...gemini, aiProviderOrder: ["none"] });
    calls = stubFetch(() => geminiOk(AI_RULES));
    assert.equal((await compileSigs("Block gambling")).res.json.mode, "fallback");
    assert.equal(calls.length, 0);
  });

  globalThis.fetch = realFetch;
}

async function main() {
  // AbortSignal.timeout() timers are unref'd; a stubbed hung fetch holds no socket, so keep the loop alive.
  setInterval(() => {}, 1000);
  console.log("A. empty keys (no provider is called)");
  setConfigOverride({ ...NO_KEYS });
  const calls = stubFetch(() => { throw new Error("network must not be touched with empty keys"); });
  await compileAndAgent("empty keys", true);
  await step("empty keys: no network calls were made", async () => assert.equal(calls.length, 0));
  globalThis.fetch = realFetch;

  console.log("\nB. fake keys (real network: providers reject them, or are unreachable)");
  setConfigOverride({ geminiApiKey: FAKE_GEMINI, anthropicApiKey: FAKE_CLAUDE, aiProviderOrder: ["gemini", "claude"], aiTimeoutMs: 5000 });
  const logs: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void logs.push(args.join(" "));
  await compileAndAgent("fake keys", false);
  console.warn = warn;
  await step("fake keys: provider failures were logged without leaking the keys", async () => {
    assert.ok(logs.some((l) => l.startsWith("[ai]")), "expected [ai] failure logs");
    assert.ok(!logs.some((l) => l.includes(FAKE_GEMINI) || l.includes(FAKE_CLAUDE)), "key leaked into logs");
  });

  console.log("\nC. provider chain with stubbed responses");
  const silence = console.warn;
  console.warn = () => {};
  try { await providerChain(); } finally { console.warn = silence; }

  console.log("\nD. engine via /api/authorize");
  setConfigOverride({ ...NO_KEYS });
  await engineChecks();

  setConfigOverride(null);
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
