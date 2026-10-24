import { atIstHour } from "./ist";
import type { PaymentRequest, Policy, RequestDraft, RuleDraft } from "./types";

// Pure drafts -> final shapes. Shared by the server pipeline (lib/tasks.ts) and the browser offline mode.

const newId = () => `req_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;

export function toPolicy(drafts: RuleDraft[], text: string): Policy {
  return {
    text,
    rules: drafts.map((d, i) => ({
      ...d,
      id: `r${i + 1}`,
      action: d.type === "ask_above" ? "ask" : d.action,
      source: d.source || text,
    })),
  };
}

export function toRequests(drafts: RequestDraft[], now = Date.now()): PaymentRequest[] {
  const picked = drafts.slice(0, 6);
  return picked.map((d, i) => ({
    id: newId(),
    merchant: d.merchant,
    vpa: d.vpa,
    amount: d.amount,
    category: d.category,
    purpose: d.purpose,
    timestamp: new Date(
      d.hourIST === undefined ? now - (picked.length - 1 - i) * 45_000 : atIstHour(now, d.hourIST),
    ).toISOString(),
  }));
}
