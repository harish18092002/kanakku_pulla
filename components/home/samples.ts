import { DEMO_POLICY_TEXT, DEMO_REQUESTS, INITIAL_WALLET } from "@/lib/demo";
import { evaluate, recordSpend } from "@/lib/engine";
import { parseRules } from "@/lib/fallback";
import { toPolicy } from "@/lib/finish";
import type { Decision, PaymentRequest, Policy } from "@/lib/types";

// The homepage's decisions come from the demo's own parser and engine, run on the demo's own sample data.
// A fixed time keeps server and browser output identical; the sample rules have no time window.
const SAMPLE_TIME = "2026-01-15T06:30:00.000Z";

export type Status = Decision["status"];
export type Sample = {
  status: Status;
  request: PaymentRequest;
  reason: string;
  rules: string[]; // the user's sentences behind the decision
};

export const RULE_LINES = DEMO_POLICY_TEXT.split("\n");
const policy: Policy = toPolicy(parseRules(DEMO_POLICY_TEXT).rules, DEMO_POLICY_TEXT);

function evaluateAll(): Sample[] {
  let wallet = INITIAL_WALLET;
  return DEMO_REQUESTS.map((draft, i) => {
    const request: PaymentRequest = {
      id: `sample_${i}`,
      merchant: draft.merchant,
      vpa: draft.vpa,
      amount: draft.amount,
      category: draft.category,
      purpose: draft.purpose,
      timestamp: SAMPLE_TIME,
    };
    const decision = evaluate(policy, wallet, request);
    if (decision.status === "approve") wallet = recordSpend(wallet, request);
    return {
      status: decision.status,
      request,
      reason: decision.reasons.join(". "),
      rules: policy.rules.filter((r) => decision.ruleIds.includes(r.id)).map((r) => r.source),
    };
  });
}

const all = evaluateAll();

/** The first sample payment the engine sent to each outcome, in approve, ask, block order. */
export const SAMPLES: Sample[] = (["approve", "ask", "block"] as const).flatMap((status) => {
  const found = all.find((s) => s.status === status);
  return found ? [found] : [];
});

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const isHit = (sample: Sample, line: string) => sample.rules.some((r) => plain(r) === plain(line));
export const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
