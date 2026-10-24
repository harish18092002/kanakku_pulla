import { DEMO_POLICY_TEXT, INITIAL_WALLET, START_BALANCE } from "./demo";
import { evaluate, recordSpend } from "./engine";
import {
  PaymentRequestSchema,
  PolicySchema,
  WalletStateSchema,
  type Mode,
  type PaymentRequest,
  type Policy,
  type Rule,
  type WalletState,
} from "./types";

// Client-side dashboard state. Money decisions come only from lib/engine (run in the browser).

export type UiMode = Mode | "offline";
export type FeedStatus = "approved" | "blocked" | "pending" | "approved_by_you" | "denied_by_you";
export type FeedItem = {
  request: PaymentRequest;
  status: FeedStatus;
  reasons: { text: string; source: string }[]; // source = the user's sentence behind the rule
};
export type AppState = {
  policyText: string;
  policy: Policy | null;
  wallet: WalletState;
  balance: number;
  feed: FeedItem[];
};
export type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "text"; text: string }
  | { type: "policy"; policy: Policy }
  | { type: "request"; request: PaymentRequest }
  | { type: "resolve"; id: string; approve: boolean }
  | { type: "reset" };

export const initialState: AppState = {
  policyText: DEMO_POLICY_TEXT,
  policy: null,
  wallet: INITIAL_WALLET,
  balance: START_BALANCE,
  feed: [],
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "text":
      return { ...state, policyText: action.text };
    case "policy":
      return { ...state, policy: action.policy };
    case "reset":
      return initialState;
    case "request": {
      const { policy } = state;
      if (!policy) return state;
      const { request } = action;
      const decision = evaluate(policy, state.wallet, request);
      const status: FeedStatus =
        decision.status === "approve" ? "approved" : decision.status === "block" ? "blocked" : "pending";
      const paid = status === "approved";
      return {
        ...state,
        wallet: paid ? recordSpend(state.wallet, request) : state.wallet,
        balance: paid ? state.balance - request.amount : state.balance,
        feed: [
          {
            request,
            status,
            reasons: decision.reasons.map((text, i) => ({
              text,
              source: policy.rules.find((r) => r.id === decision.ruleIds[i])?.source ?? "",
            })),
          },
          ...state.feed,
        ].slice(0, 50),
      };
    }
    case "resolve": {
      const item = state.feed.find((i) => i.request.id === action.id && i.status === "pending");
      if (!item) return state;
      return {
        ...state,
        // Approving counts the spend and adds the merchant to known merchants (recordSpend does both).
        wallet: action.approve ? recordSpend(state.wallet, item.request) : state.wallet,
        balance: action.approve ? state.balance - item.request.amount : state.balance,
        feed: state.feed.map((i) =>
          i === item ? { ...i, status: action.approve ? "approved_by_you" : "denied_by_you" } : i,
        ),
      };
    }
  }
}

// ---------- localStorage (the "local" store) ----------

const KEY = "kanakku:v1";
const STATUSES: FeedStatus[] = ["approved", "blocked", "pending", "approved_by_you", "denied_by_you"];

export function loadSaved(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    const wallet = WalletStateSchema.safeParse(j.wallet);
    const policy = j.policy ? PolicySchema.safeParse(j.policy) : null;
    if (!wallet.success || (policy && !policy.success)) return null;
    if (typeof j.policyText !== "string" || typeof j.balance !== "number" || !Array.isArray(j.feed)) return null;
    const feed = (j.feed as FeedItem[]).filter(
      (i) => STATUSES.includes(i?.status) && Array.isArray(i.reasons) && PaymentRequestSchema.safeParse(i.request).success,
    );
    return { policyText: j.policyText, policy: policy?.success ? policy.data : null, wallet: wallet.data, balance: j.balance, feed };
  } catch {
    return null;
  }
}

export function save(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: the dashboard still works in memory
  }
}

// ---------- formatting ----------

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hour12 = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

export function ruleLabel(rule: Rule): string {
  switch (rule.type) {
    case "max_per_txn":
      return `Max ${inr(rule.params.amount)} per payment`;
    case "daily_total_cap":
      return `Daily cap ${inr(rule.params.amount)}`;
    case "category_daily_cap":
      return `${cap(rule.params.category)} cap ${inr(rule.params.amount)}/day`;
    case "ask_above":
      return `Above ${inr(rule.params.amount)}`;
    case "new_merchant":
      return "New merchants";
    case "blocked_category":
      return cap(rule.params.category);
    case "blocked_merchant":
      return rule.params.merchant;
    case "time_window":
      return `${hour12(rule.params.startHour)}–${hour12(rule.params.endHour)} IST`;
  }
}
