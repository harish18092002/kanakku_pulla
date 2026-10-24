import { readBody, reply } from "@/lib/api";
import { evaluate } from "@/lib/engine";
import { PaymentRequestSchema, PolicySchema, WalletStateSchema, type Decision } from "@/lib/types";

const block = (reason: string): Decision => ({ status: "block", reasons: [reason], ruleIds: [] });

// Fail closed: anything we can't read means no money moves.
function decide(body: Record<string, unknown>): Decision {
  const request = PaymentRequestSchema.safeParse(body.request);
  if (!request.success) return block("The payment request is invalid");
  const policy = PolicySchema.safeParse(body.policy);
  if (!policy.success) return block("The policy is missing or unreadable");
  const state = WalletStateSchema.safeParse(body.state ?? {});
  if (!state.success) return block("The wallet state is unreadable");
  return evaluate(policy.data, state.data, request.data);
}

// POST { policy, state, request } -> { decision, mode, store }. Always HTTP 200.
// The decision comes only from the engine; no AI is involved, so mode is always "fallback".
export async function POST(req: Request) {
  const body = await readBody(req);
  try {
    return reply({ decision: decide(body) }, "fallback");
  } catch (err) {
    console.error("[authorize]", err instanceof Error ? err.name : "unknown error");
    return reply({ decision: block("Could not evaluate the payment") }, "fallback");
  }
}
