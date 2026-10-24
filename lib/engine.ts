import { istDay, istHour } from "./ist";
import type { Decision, PaymentRequest, Policy, Rule, WalletState } from "./types";

// The ONLY place money decisions are made. Pure TS (no I/O, no config) so server and browser share it.
// Precedence: BLOCK > ASK > APPROVE. A rule's `action` says what happens when it triggers.

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const hour12 = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Ctx = { spent: number; categorySpent: number; hour: number; known: Set<string> };

function violation(rule: Rule, req: PaymentRequest, ctx: Ctx): string | null {
  switch (rule.type) {
    case "max_per_txn":
      return req.amount > rule.params.amount
        ? `${inr(req.amount)} is above the ${inr(rule.params.amount)} per-payment limit`
        : null;
    case "ask_above":
      return req.amount > rule.params.amount
        ? `${inr(req.amount)} is above ${inr(rule.params.amount)}, which needs your approval`
        : null;
    case "daily_total_cap":
      return ctx.spent + req.amount > rule.params.amount
        ? `Today's spending would reach ${inr(ctx.spent + req.amount)}, over the ${inr(rule.params.amount)} daily cap`
        : null;
    case "category_daily_cap":
      return req.category === rule.params.category && ctx.categorySpent + req.amount > rule.params.amount
        ? `${req.category} spending today would reach ${inr(ctx.categorySpent + req.amount)}, over the ${inr(rule.params.amount)} ${req.category} cap`
        : null;
    case "new_merchant":
      return ctx.known.has(req.vpa.toLowerCase()) ? null : `${req.merchant} is a new merchant`;
    case "blocked_category":
      return req.category === rule.params.category ? `${req.category} payments are not allowed` : null;
    case "blocked_merchant": {
      const needle = squash(rule.params.merchant);
      return needle.length >= 2 && squash(`${req.merchant} ${req.vpa}`).includes(needle)
        ? `${req.merchant} is on your blocked merchants list`
        : null;
    }
    case "time_window": {
      const { startHour: s, endHour: e } = rule.params;
      const inside = s < e ? ctx.hour >= s && ctx.hour < e : ctx.hour >= s || ctx.hour < e;
      return inside ? `Payments between ${hour12(s)} and ${hour12(e)} IST are restricted` : null;
    }
  }
}

export const emptyState = (): WalletState => ({
  day: "",
  spentToday: 0,
  spentByCategory: {},
  knownMerchants: [],
});

export function evaluate(policy: Policy, state: WalletState, req: PaymentRequest): Decision {
  const ms = Date.parse(req.timestamp);
  if (!Number.isFinite(ms)) {
    return { status: "ask", reasons: ["Payment time is invalid, so it needs your approval"], ruleIds: [] };
  }
  // Totals only count if they belong to the same IST day as this payment.
  const sameDay = state.day === istDay(ms);
  const ctx: Ctx = {
    spent: sameDay ? state.spentToday : 0,
    categorySpent: sameDay ? (state.spentByCategory[req.category] ?? 0) : 0,
    hour: istHour(ms),
    known: new Set(state.knownMerchants.map((v) => v.toLowerCase())),
  };

  const hits: { rule: Rule; why: string }[] = [];
  for (const rule of policy.rules) {
    const why = violation(rule, req, ctx);
    if (why) hits.push({ rule, why });
  }
  if (hits.length === 0) return { status: "approve", reasons: ["Within all your rules"], ruleIds: [] };

  const blockers = hits.filter((h) => h.rule.action === "block");
  const winners = blockers.length ? blockers : hits; // only the winning tier explains the outcome
  return {
    status: blockers.length ? "block" : "ask",
    reasons: winners.map((h) => h.why),
    ruleIds: winners.map((h) => h.rule.id),
  };
}

/** State after `req` has actually been paid (approved, or approved by the human after an "ask"). */
export function recordSpend(state: WalletState, req: PaymentRequest): WalletState {
  const ms = Date.parse(req.timestamp);
  if (!Number.isFinite(ms)) return state;
  const day = istDay(ms);
  const base = state.day === day ? state : { ...emptyState(), knownMerchants: state.knownMerchants, day };
  const vpa = req.vpa.toLowerCase();
  return {
    day,
    spentToday: base.spentToday + req.amount,
    spentByCategory: {
      ...base.spentByCategory,
      [req.category]: (base.spentByCategory[req.category] ?? 0) + req.amount,
    },
    knownMerchants: base.knownMerchants.includes(vpa) ? base.knownMerchants : [...base.knownMerchants, vpa],
  };
}
