import type { Category, RequestDraft, RuleDraft } from "./types";

// Server-side rule-based fallback: no AI, no network. Pure functions.

// ---------- rule parser ----------

const CATEGORY_WORDS: [Category, RegExp][] = [
  ["food", /\b(?:food|dining|restaurants?|meals?|groceries|grocery|takeaway)\b/],
  ["travel", /\b(?:travel|cabs?|taxis?|flights?|trains?|buses|bus|hotels?|trips?)\b/],
  ["shopping", /\b(?:shopping|clothes|clothing|fashion|gadgets?|e-?commerce)\b/],
  ["entertainment", /\b(?:entertainment|movies?|cinema|gaming|games?|ott)\b/],
  ["bills", /\b(?:bills?|utilit(?:y|ies)|electricity|recharges?|broadband|rent)\b/],
  ["subscriptions", /\b(?:subscriptions?|memberships?)\b/],
  ["gambling", /\b(?:gambling|gamble|betting|bets?|casinos?|lottery|rummy|poker|fantasy)\b/],
  ["crypto", /\b(?:crypto\w*|bitcoin|btc|ethereum|nfts?)\b/],
  ["other", /\b(?:misc|miscellaneous)\b/],
];
const categoriesIn = (s: string) => CATEGORY_WORDS.filter(([, re]) => re.test(s)).map(([c]) => c);

const ASK = /\b(?:ask|confirm|confirmation|approval|approve|check with me|verify|permission)\b/;
const BLOCK = /\b(?:block|blocked|never|no|don'?t|do not|dont|stop|forbid|ban|banned|avoid|prevent|disallow|not allow(?:ed)?|deny|refuse|reject)\b/;
const NEW_MERCHANT =
  /\b(?:new|unknown|unfamiliar|unrecogni[sz]ed|unseen|first[- ]time)\s+(?:merchants?|payees?|vendors?|recipients?|beneficiar\w+|sellers?|shops?|stores?|upi ids?|vpas?)\b|\bpaying\s+(?:anyone|someone|somebody)\s+new\b/;
const DAY = /\b(?:day|daily|today)\b/;
const TXN =
  /\b(?:per|each|every|single|any|one|a)\s+(?:single\s+)?(?:transaction|txn|payment|purchase|order|transfer)s?\b|\bsingle\b|\bat once\b|\bin one go\b|\bone[- ]time\b|\/\s*(?:txn|transaction|payment|order)/;

const UNIT: Record<string, number> = {
  k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7,
};
const AMOUNT_RE =
  /(₹\s*)?(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|crores?|cr)?\b(\s*(?:rupees?|inr))?(?!\s*(?:am|pm|a\.m|p\.m|%|:))/gi;
const COMPARATOR =
  /(?:above|over|under|below|exceed(?:s|ing)?|than|beyond|upto|up to|at most|at least|max(?:imum)?(?: of)?|limit(?:ed)?(?: of| to| is)?|cap(?:ped)?(?: of| at| to| is)?|budget(?: of| is)?|[<>]=?|:)\s*$/i;

type Amount = { value: number; start: number; end: number };

function amountsIn(s: string): Amount[] {
  const found: Amount[] = [];
  for (const m of s.matchAll(AMOUNT_RE)) {
    const start = m.index ?? 0;
    const marked = m[1] || m[3] || m[4] || COMPARATOR.test(s.slice(Math.max(0, start - 20), start));
    if (!marked) continue;
    const value = Math.round(parseFloat(m[2].replace(/,/g, "")) * (m[3] ? UNIT[m[3].toLowerCase()] : 1));
    if (value >= 1 && value <= 1e9) found.push({ value, start, end: start + m[0].length });
  }
  return found;
}

/** Cut a sentence into one clause per amount at the "and / but / ," between them. */
function clausesOf(s: string, amounts: Amount[]): { text: string; amount: Amount }[] {
  const cuts = [0];
  for (let i = 0; i + 1 < amounts.length; i++) {
    const gap = s.slice(amounts[i].end, amounts[i + 1].start);
    const seps = [...gap.matchAll(/\s*(?:,|;|&|\band\b|\bbut\b|\bwhile\b)\s*/g)];
    const last = seps[seps.length - 1];
    cuts.push(last ? amounts[i].end + (last.index ?? 0) + last[0].length : -1);
  }
  const clauses: { text: string; amount: Amount }[] = [];
  amounts.forEach((amount, i) => {
    if (cuts[i] === -1) return; // no separator before this amount: it stays in the previous clause
    let next = i + 1;
    while (next < amounts.length && cuts[next] === -1) next++;
    clauses.push({ text: s.slice(cuts[i], next < amounts.length ? cuts[next] : s.length), amount });
  });
  return clauses;
}

const TIME_RE = /\b(?:(\d{1,2})(?::\d{2})?\s*(am|pm)|(\d{1,2}):\d{2}|(midnight)|(noon))\b/g;

function hoursIn(s: string): number[] {
  const hours: number[] = [];
  for (const m of s.matchAll(TIME_RE)) {
    const h = m[2] ? (Number(m[1]) % 12) + (m[2] === "pm" ? 12 : 0) : m[3] ? Number(m[3]) : m[4] ? 0 : 12;
    if (h >= 0 && h <= 23) hours.push(h);
  }
  return hours;
}

/** The RESTRICTED window [start, end) in IST hours, or null. */
function restrictedWindow(s: string): [number, number] | null {
  const hours = hoursIn(s);
  const inverse = /\b(?:only|except|outside)\b/.test(s);
  if (hours.length >= 2 && /\b(?:between|from|to|until|till)\b|[-–—]/.test(s)) {
    const [a, b] = hours;
    return a === b ? null : inverse ? [b, a] : [a, b];
  }
  if (hours.length === 1) {
    const h = hours[0];
    if (/\b(?:after|past|from)\b/.test(s)) {
      const end = h < 6 ? h + 4 : 6;
      return [h, end === h ? (h + 8) % 24 : end];
    }
    if (/\bbefore\b/.test(s) && h > 0) return [0, h];
    return null;
  }
  return /\b(?:at night|late[- ]night|overnight|night[- ]?time)\b/.test(s) ? [22, 6] : null;
}

const MERCHANT_CUE =
  /\b(?:block(?:ed)?|never pay(?:ing)?(?: to)?|don'?t pay(?: to)?|do not pay(?: to)?|stop paying|no payments? to|avoid(?: paying)?|ban(?:ned)?|ask (?:me )?(?:before|for|about)(?: paying| payments? to)?)\s+(.+)$/i;
const FILLER =
  /\b(?:any|all|the|payments?|transactions?|to|for|from|at|on|merchants?|vendors?|apps?|sites?|websites?|called|named|please|ever|again|anything|everything|me|my|you|them|it)\b/gi;
const NOT_A_MERCHANT =
  /^(?:over\s*spend\w*|spend\w*|too much|more|extra|unnecessary|suspicious|random|unknown|big|large|expensive|stuff|things?|late|night|late night|payments?)$/i;

function merchantsIn(sentence: string): string[] {
  const rest = MERCHANT_CUE.exec(sentence)?.[1];
  if (!rest) return [];
  return rest
    .replace(/[.!?]+$/, "")
    .replace(FILLER, " ")
    .split(/,|\band\b|\bor\b|&/i)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(
      (p) =>
        p.length >= 2 &&
        p.split(" ").length <= 3 &&
        !/^[\d₹]/.test(p) &&
        !NOT_A_MERCHANT.test(p) &&
        categoriesIn(p.toLowerCase()).length === 0,
    );
}

function parseSentence(sentence: string, warnings: string[]): RuleDraft[] {
  const s = sentence.toLowerCase();
  const source = sentence.trim();
  const rules: RuleDraft[] = [];
  const ask = ASK.test(s);

  let matchedNew = false;
  if (NEW_MERCHANT.test(s)) {
    matchedNew = true;
    rules.push({ type: "new_merchant", params: {}, action: ask || !BLOCK.test(s) ? "ask" : "block", source });
  }

  const win = restrictedWindow(s);
  if (win) {
    rules.push({ type: "time_window", params: { startHour: win[0], endHour: win[1] }, action: ask ? "ask" : "block", source });
  }

  const amounts = amountsIn(s);
  for (const { text, amount } of amounts.length ? clausesOf(s, amounts) : []) {
    const action = ASK.test(text) ? "ask" : "block";
    const txn = TXN.test(text);
    const category = categoriesIn(text)[0];
    if (category && !txn) {
      rules.push({ type: "category_daily_cap", params: { category, amount: amount.value }, action, source });
    } else if (DAY.test(text) && !txn) {
      rules.push({ type: "daily_total_cap", params: { amount: amount.value }, action, source });
    } else if (action === "ask") {
      rules.push({ type: "ask_above", params: { amount: amount.value }, action: "ask", source });
    } else {
      if (category) warnings.push(`"${source}": no per-payment category rule exists, so the limit applies to all categories.`);
      rules.push({ type: "max_per_txn", params: { amount: amount.value }, action, source });
    }
  }

  if (!win && amounts.length === 0 && (BLOCK.test(s) || ask)) {
    for (const category of categoriesIn(s)) {
      rules.push({ type: "blocked_category", params: { category }, action: ask ? "ask" : "block", source });
    }
    if (!matchedNew) {
      for (const merchant of merchantsIn(sentence)) {
        rules.push({ type: "blocked_merchant", params: { merchant }, action: ask ? "ask" : "block", source });
      }
    }
  }
  return rules;
}

export function parseRules(text: string): { rules: RuleDraft[]; warnings: string[] } {
  const normalised = text
    .replace(/[’‘]/g, "'")
    .replace(/\b(?:rs|inr)\.?\s*(?=\d)/gi, "₹")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "");
  const warnings: string[] = [];
  const seen = new Set<string>();
  const rules: RuleDraft[] = [];
  for (const sentence of normalised.split(/(?<=[.!?;])\s+|\n+/).filter((p) => p.trim())) {
    const found = parseSentence(sentence, warnings);
    if (found.length === 0) warnings.push(`Couldn't turn this into a rule: "${sentence.trim()}"`);
    for (const rule of found) {
      const key = JSON.stringify([rule.type, rule.params, rule.action]);
      if (!seen.has(key)) {
        seen.add(key);
        rules.push(rule);
      }
    }
  }
  return { rules, warnings };
}

// ---------- scripted agent ----------

type Step = [merchant: string, vpa: string, amount: number, category: Category, purpose: string, hourIST?: number];

const SCRIPTS: { name: string; match: RegExp; steps: Step[] }[] = [
  {
    name: "food",
    match: /food|dinner|lunch|breakfast|eat|biryani|pizza|restaurant|swiggy|zomato|grocer/i,
    steps: [
      ["Swiggy", "swiggy@icici", 349, "food", "Dinner: butter chicken and naan"],
      ["Zomato", "zomato@hdfcbank", 1280, "food", "Group lunch order for 4"],
      ["Domino's Pizza", "dominos@icici", 899, "food", "Weekend pizza combo"],
      ["BigBasket", "bigbasket@axisbank", 2450, "food", "Weekly groceries"],
      ["Blue Tokai Coffee", "bluetokai@okaxis", 480, "food", "Coffee beans, 2 packs"],
    ],
  },
  {
    name: "travel",
    match: /travel|trip|flight|train|hotel|cab|vacation|holiday|goa|ticket|book/i,
    steps: [
      ["IRCTC", "irctc@sbi", 1845, "travel", "Chennai to Bengaluru Shatabdi, 2 seats"],
      ["MakeMyTrip", "makemytrip@icici", 8950, "travel", "Bengaluru to Goa return flight"],
      ["OYO Rooms", "oyorooms@yesbank", 3600, "travel", "Goa beach hotel, 2 nights"],
      ["Uber India", "uber@axisbank", 412, "travel", "Airport cab"],
      ["RedBus", "redbus@hdfcbank", 1150, "travel", "Return bus to Chennai"],
    ],
  },
  {
    name: "shopping",
    match: /shop|buy|gift|diwali|festival|clothes|amazon|flipkart|myntra|gadget|purchase/i,
    steps: [
      ["Amazon", "amazon@apl", 2499, "shopping", "Wireless earbuds"],
      ["Flipkart", "flipkart@axisbank", 7999, "shopping", "Smartwatch as a gift"],
      ["Myntra", "myntra@icici", 3298, "shopping", "Festive kurta set"],
      ["Nykaa", "nykaa@hdfcbank", 1850, "shopping", "Skincare for Diwali gift hamper"],
      ["Croma", "croma@sbi", 32990, "shopping", "Laptop for family"],
    ],
  },
  {
    name: "bills",
    match: /bill|recharge|electricity|rent|utilit|broadband|dth|emi|subscri|netflix|renew|ott/i,
    steps: [
      ["Jio", "jio@icici", 299, "bills", "Monthly mobile recharge"],
      ["BESCOM", "bescom@sbi", 1860, "bills", "Electricity bill"],
      ["Airtel Xstream Fiber", "airtelfiber@axisbank", 999, "bills", "Broadband bill"],
      ["Netflix", "netflix@hdfcbank", 649, "subscriptions", "Monthly plan renewal"],
      ["LIC of India", "lic@sbi", 12000, "bills", "Quarterly insurance premium"],
    ],
  },
];

const MIXED: Step[] = [
  ["Swiggy", "swiggy@icici", 420, "food", "Late-night biryani", 1],
  ["Uber India", "uber@axisbank", 385, "travel", "Cab to office"],
  ["Amazon", "amazon@apl", 1899, "shopping", "Phone case and charger"],
  ["Netflix", "netflix@hdfcbank", 649, "subscriptions", "Monthly plan renewal"],
  ["Dream11", "dream11@yesbank", 2000, "gambling", "Add cash to fantasy cricket wallet"],
  ["CoinDCX", "coindcx@icici", 5000, "crypto", "Buy ETH"],
];

/** 3-6 deterministic, realistic Indian payment requests for a task. */
export function scriptedRequests(task: string): RequestDraft[] {
  const hits = SCRIPTS.filter((s) => s.match.test(task));
  const steps = hits.length === 1 ? hits[0].steps : MIXED;
  return steps.map(([merchant, vpa, amount, category, purpose, hourIST]) => ({
    merchant, vpa, amount, category, purpose, hourIST,
  }));
}
