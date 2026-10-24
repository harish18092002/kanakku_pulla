import { z } from "zod";

// Domain types (see Claude.md). Shared by server, browser and the LLM output validators.

export type Mode = "gemini" | "claude" | "fallback";
export type Store = "firestore" | "local";

export const CATEGORIES = [
  "food",
  "travel",
  "shopping",
  "entertainment",
  "bills",
  "subscriptions",
  "gambling",
  "crypto",
  "other",
] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

// LLMs say "Food" or 1299.5; accept that and normalise instead of failing the provider.
const LooseCategory = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  CategorySchema,
);
const Amount = z.number().min(1).max(1_000_000_000).transform(Math.round);
const Hour = z
  .number()
  .min(0)
  .max(24)
  .transform((n) => Math.round(n) % 24);

const ruleBase = {
  action: z.enum(["block", "ask"]),
  source: z.string().trim().max(500).default(""),
};
const rule = <T extends string, P extends z.ZodType>(type: T, params: P) =>
  z.object({ type: z.literal(type), params, ...ruleBase });

// A rule before it gets an id. This is also the shape the LLM is asked to produce.
// time_window = the RESTRICTED hours (IST, 24h clock): start inclusive, end exclusive, may wrap midnight.
export const RuleDraftSchema = z.discriminatedUnion("type", [
  rule("max_per_txn", z.object({ amount: Amount })),
  rule("daily_total_cap", z.object({ amount: Amount })),
  rule("category_daily_cap", z.object({ category: LooseCategory, amount: Amount })),
  rule("ask_above", z.object({ amount: Amount })),
  rule("new_merchant", z.object({}).default({})),
  rule("blocked_category", z.object({ category: LooseCategory })),
  rule("blocked_merchant", z.object({ merchant: z.string().trim().min(2).max(60) })),
  rule(
    "time_window",
    z
      .object({ startHour: Hour, endHour: Hour })
      .refine((p) => p.startHour !== p.endHour, "empty time window"),
  ),
]);
export type RuleDraft = z.infer<typeof RuleDraftSchema>;

export const RuleSchema = RuleDraftSchema.and(z.object({ id: z.string().min(1) }));
export type Rule = z.infer<typeof RuleSchema>;

export const PolicySchema = z.object({
  rules: z.array(RuleSchema).max(50),
  text: z.string().default(""),
});
export type Policy = z.infer<typeof PolicySchema>;

const VPA = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,30}$/;

export const PaymentRequestSchema = z.object({
  id: z.string().min(1),
  merchant: z.string().trim().min(1).max(100),
  vpa: z.string().trim().regex(VPA),
  amount: z.number().int().min(1).max(1_000_000_000), // INR
  category: CategorySchema,
  purpose: z.string().trim().max(200).default(""),
  timestamp: z.string().refine((s) => Number.isFinite(Date.parse(s)), "invalid timestamp"),
});
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

// What the agent LLM (or the scripted fallback) produces; id and timestamp are stamped by us.
export const RequestDraftSchema = z.object({
  merchant: z.string().trim().min(1).max(60),
  vpa: z.string().trim().regex(VPA),
  amount: Amount,
  category: LooseCategory,
  purpose: z.string().trim().max(120).default(""),
  hourIST: Hour.optional(),
});
export type RequestDraft = z.infer<typeof RequestDraftSchema>;

export const DecisionSchema = z.object({
  status: z.enum(["approve", "ask", "block"]),
  reasons: z.array(z.string()),
  ruleIds: z.array(z.string()),
});
export type Decision = z.infer<typeof DecisionSchema>;

// What the engine needs to know about the wallet's history. `day` is the IST date the totals belong to.
export const WalletStateSchema = z.object({
  day: z.string().default(""),
  spentToday: z.number().min(0).default(0),
  spentByCategory: z.partialRecord(CategorySchema, z.number().min(0)).default({}),
  knownMerchants: z.array(z.string()).default([]), // lowercase VPAs paid before
});
export type WalletState = z.infer<typeof WalletStateSchema>;
