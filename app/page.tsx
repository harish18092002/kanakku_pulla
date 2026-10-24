"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { z } from "zod";
import { AgentPanel } from "@/components/AgentPanel";
import { ApiCard } from "@/components/ApiCard";
import { Feed } from "@/components/Feed";
import { Header } from "@/components/Header";
import { RulesPanel } from "@/components/RulesPanel";
import { Splash } from "@/components/Splash";
import { initialState, loadSaved, reducer, save, type UiMode } from "@/lib/dashboard";
import { DEMO_POLICY_TEXT, DEMO_REQUESTS, DEMO_TASK } from "@/lib/demo";
import { parseRules, scriptedRequests } from "@/lib/fallback";
import { toPolicy, toRequests } from "@/lib/finish";
import { PaymentRequestSchema, PolicySchema, type Mode, type PaymentRequest, type Policy, type Store } from "@/lib/types";

const MAX_TEXT = 2000;
const RequestsSchema = z.array(PaymentRequestSchema).min(1).max(12);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const asMode = (v: unknown): Mode => (v === "gemini" || v === "claude" ? v : "fallback");
const asStore = (v: unknown): Store => (v === "firestore" ? "firestore" : "local");

// Any failure (network, non-200, bad JSON) returns null and the page switches to its in-browser fallback.
async function callApi(path: string, body: object): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [task, setTask] = useState(DEMO_TASK);
  const [mode, setMode] = useState<UiMode | null>(null);
  const [store, setStore] = useState<Store>("local");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [compiling, setCompiling] = useState(false);
  const [busy, setBusy] = useState<"agent" | "demo" | null>(null);
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  const runId = useRef(0); // bumping this cancels any in-flight agent/demo loop

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const t = setTimeout(() => {
      const saved = loadSaved();
      if (saved) dispatch({ type: "hydrate", state: saved });
      setHydrated(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hydrated) save(state);
  }, [hydrated, state]);

  async function compile(raw: string): Promise<Policy> {
    const text = raw.trim().slice(0, MAX_TEXT);
    setCompiling(true);
    const res = await callApi("/api/compile", { text });
    const parsed = res ? PolicySchema.safeParse(res.policy) : null;
    let policy: Policy;
    if (res && parsed?.success) {
      policy = parsed.data;
      setMode(asMode(res.mode));
      setStore(asStore(res.store));
      setWarnings(Array.isArray(res.warnings) ? res.warnings.filter((w): w is string => typeof w === "string") : []);
    } else {
      const local = parseRules(text);
      policy = toPolicy(local.rules, text);
      setMode("offline");
      setStore("local");
      setWarnings(local.rules.length ? local.warnings : [...local.warnings, "No spending rules were found in that text."]);
    }
    dispatch({ type: "policy", policy });
    setCompiling(false);
    return policy;
  }

  async function ensurePolicy(): Promise<Policy> {
    const { policyText, policy } = stateRef.current;
    const text = policyText.trim().slice(0, MAX_TEXT);
    return policy && policy.text === text ? policy : compile(text);
  }

  async function feedRequests(requests: PaymentRequest[], gapMs: number, id: number, onStep?: (i: number) => void) {
    for (let i = 0; i < requests.length; i++) {
      if (i > 0) await sleep(gapMs);
      if (runId.current !== id) return;
      onStep?.(i);
      dispatch({ type: "request", request: requests[i] });
    }
  }

  async function runAgent() {
    const id = ++runId.current;
    setBusy("agent");
    setNote("Checking your rules…");
    await ensurePolicy();
    if (runId.current !== id) return;
    setNote("Agent is planning payments…");
    const res = await callApi("/api/agent", { task });
    const parsed = res ? RequestsSchema.safeParse(res.requests) : null;
    let requests: PaymentRequest[];
    if (res && parsed?.success) {
      requests = parsed.data;
      setMode(asMode(res.mode));
      setStore(asStore(res.store));
    } else {
      requests = toRequests(scriptedRequests(task));
      setMode("offline");
      setStore("local");
    }
    if (runId.current !== id) return;
    await feedRequests(requests, 700, id, (i) => setNote(`Agent payment ${i + 1} of ${requests.length}`));
    if (runId.current === id) {
      setBusy(null);
      setNote(`Agent finished: ${requests.length} payments checked`);
    }
  }

  async function runDemo() {
    const id = ++runId.current;
    setBusy("demo");
    dispatch({ type: "reset" });
    setNote("Demo: loading the sample rules…");
    await compile(DEMO_POLICY_TEXT);
    if (runId.current !== id) return;
    const requests = DEMO_REQUESTS.map((draft) => toRequests([draft])[0]);
    await feedRequests(requests, 1000, id, (i) => setNote(`Demo: payment ${i + 1} of ${requests.length}`));
    if (runId.current === id) {
      setBusy(null);
      setNote("Demo finished. Approve or deny the amber cards.");
    }
  }

  function reset() {
    runId.current++;
    dispatch({ type: "reset" });
    setMode(null);
    setStore("local");
    setWarnings([]);
    setCompiling(false);
    setBusy(null);
    setNote("");
    setTask(DEMO_TASK);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Splash />
      <Header balance={state.balance} wallet={state.wallet} mode={mode} store={store} />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 lg:grid-cols-3">
        <RulesPanel
          text={state.policyText}
          onText={(text) => dispatch({ type: "text", text })}
          onCompile={() => void compile(state.policyText)}
          compiling={compiling}
          policy={state.policy}
          warnings={warnings}
        />
        <AgentPanel
          task={task}
          onTask={setTask}
          busy={busy}
          note={note}
          onRun={() => void runAgent()}
          onDemo={() => void runDemo()}
          onReset={reset}
        />
        <Feed items={state.feed} onResolve={(id, approve) => dispatch({ type: "resolve", id, approve })} />
        <div className="lg:col-span-3">
          <ApiCard />
        </div>
      </main>
    </div>
  );
}
