import type { RequestDraft, WalletState } from "./types";

// Demo content for the dashboard. Pure data, safe for the browser.

export const START_BALANCE = 50_000;

export const DEMO_POLICY_TEXT = [
  "Never pay more than ₹5,000 in a single payment.",
  "Ask me before anything above ₹1,000.",
  "Keep food under ₹1,500 a day.",
  "Block gambling and crypto.",
  "Ask me before paying new merchants.",
  "Block anything on Zomato.",
].join("\n");

export const DEMO_TASK = "Run my weekend errands: dinner, a cab, shopping and subscriptions";

// Merchants the wallet has paid before, so "new merchant" only fires for genuinely new ones.
export const INITIAL_WALLET: WalletState = {
  day: "",
  spentToday: 0,
  spentByCategory: {},
  knownMerchants: ["swiggy@icici", "uber@axisbank", "netflix@hdfcbank", "irctc@sbi"],
};

// 8 scripted requests -> 3 approved, 2 need you, 3 blocked against DEMO_POLICY_TEXT.
export const DEMO_REQUESTS: RequestDraft[] = [
  { merchant: "Swiggy", vpa: "swiggy@icici", amount: 349, category: "food", purpose: "Dinner: butter chicken and naan" },
  { merchant: "Uber India", vpa: "uber@axisbank", amount: 385, category: "travel", purpose: "Cab to the airport" },
  { merchant: "Zomato", vpa: "zomato@hdfcbank", amount: 620, category: "food", purpose: "Lunch for the team" },
  { merchant: "Amazon", vpa: "amazon@apl", amount: 2499, category: "shopping", purpose: "Wireless earbuds" },
  { merchant: "Netflix", vpa: "netflix@hdfcbank", amount: 649, category: "subscriptions", purpose: "Monthly plan renewal" },
  { merchant: "Swiggy", vpa: "swiggy@icici", amount: 1350, category: "food", purpose: "Party order for 8" },
  { merchant: "Dream11", vpa: "dream11@yesbank", amount: 2000, category: "gambling", purpose: "Add cash to fantasy wallet" },
  { merchant: "IRCTC", vpa: "irctc@sbi", amount: 1845, category: "travel", purpose: "Chennai to Bengaluru, 2 seats" },
];
