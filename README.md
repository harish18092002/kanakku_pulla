<p align="center">
  <img src="public/brand/logo.gif" alt="Kanakku Pulla logo animation" width="360">
</p>

# Kanakku Pulla (கணக்குப் புள்ள)

**An AI agent wallet with plain-English spending guardrails.**

Tell the wallet your rules in everyday language ("Never pay more than ₹5,000 in a single payment. Block gambling and crypto. Ask me before paying new merchants."). An AI agent then tries to make payments, and every payment is checked against your rules before any money moves. Built for a hackathon live demo.

## How it works

1. **Write rules** in plain English and click *Compile*. They become structured rules, and each rule keeps the sentence it came from.
2. **Give the agent a task.** It proposes 3–6 realistic Indian UPI payments. With **Search the web live** on, Gemini uses Google Search to find real merchants and prices, and the *Agent suggestions* box shows what it searched for.
3. **Every payment gets a verdict** in the live feed: **Approved**, **Blocked**, or **Needs you** (with Approve and Deny buttons). Each reason quotes the sentence you wrote.

**The LLM never decides money.** Verdicts come from a small deterministic rules engine ([`lib/engine.ts`](lib/engine.ts)) shared by the server and the browser. Precedence is BLOCK > ASK > APPROVE.

**It never fails.** Compile and agent calls try Gemini, then Claude, then a rule-based fallback on the server, then an in-browser fallback if the API is unreachable. The UI shows which one answered (Gemini, Claude, Fallback, or Offline). Provider errors, timeouts and bad JSON all just move to the next step.

## Rule types

`max_per_txn` · `daily_total_cap` · `category_daily_cap` · `ask_above` · `new_merchant` · `blocked_category` · `blocked_merchant` · `time_window` (IST). Each rule either **blocks** or **asks** you.

## Run it

```bash
npm install
cp .env.example .env     # add GEMINI_API_KEY and/or ANTHROPIC_API_KEY (both optional)
npm run dev              # http://localhost:3000
```

Click **Run sample scenario** to see 8 fixed payments hit the sample rules, one per second. With no API keys at all, everything still works in fallback mode.

| Script | What it does |
|---|---|
| `npm run build` | Production build |
| `npm run check:fallback` | Proves compile, agent and authorize work with empty keys, fake keys and failing providers |
| `npm run lint` | ESLint |

## API

All routes return HTTP 200 with the same shape in every mode, including `mode` (`gemini` / `claude` / `fallback`) and `store`.

| Route | Body | Returns |
|---|---|---|
| `POST /api/compile` | `{ text }` | `{ policy, warnings }` |
| `POST /api/agent` | `{ task, search? }` | `{ requests, search }` |
| `POST /api/authorize` | `{ policy, state, request }` | `{ decision }` |

To try them, import [`insomnia/kanakku-pulla.insomnia.json`](insomnia/kanakku-pulla.insomnia.json) into Insomnia (20 requests with documented expected results).

## Configuration

Config is read **only** from the `.env` file in the project root, through [`lib/config.ts`](lib/config.ts). Shell environment variables are ignored. See [`.env.example`](.env.example) for every key (`AI_PROVIDER_ORDER`, `AI_TIMEOUT_MS`, `AI_SEARCH_TIMEOUT_MS`, `GEMINI_*`, `ANTHROPIC_*`, `GCP_PROJECT_ID`, `FIRESTORE_ENABLED`).

## Project layout

```
app/            dashboard (page.tsx) and the three API routes
components/     header, rules panel, agent panel, live feed, intro splash
lib/engine.ts   the rules engine: the only place money decisions are made
lib/ai.ts       Gemini (REST) then Claude (SDK), with timeouts and validation
lib/fallback.ts regex rule parser and scripted agent payments
insomnia/       API test collection
public/brand/   logo (png, mp4, and the animated gif used above)
```

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript, zod, `@anthropic-ai/sdk`, and the Gemini REST API.

## Status

Wallet state is kept in the browser (`localStorage`). Firestore persistence (`firebase-admin`) and the Cloud Run deployment are planned but not wired up yet, so the `store` pill always reads *Local* for now.
