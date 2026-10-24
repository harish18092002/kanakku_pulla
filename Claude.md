# kanakku_pulla
"Kanakku Pulla": AI agent wallet with plain-English spending guardrails. Hackathon: 50 min build, live demo.

## Hard rules
- NEVER run git commands. Never deploy. Never run gcloud/firebase CLI. Stay inside this folder.
- Deps allowed: next, react, tailwind, @anthropic-ai/sdk, zod, firebase-admin, tsx (dev). Gemini is called with fetch (REST), no SDK. Nothing else.
- Config ONLY from the `.env` file in the project root, read through lib/config.ts. No global/shell env vars. Keep `.env.example` in sync.
- Never log, hardcode or send secrets to the client.
- Don't ask me questions. Pick sensible defaults and list them at the end.
- After each task run `npm run build` and fix all errors. Keep files small.

## Always-fallback rule (most important)
- AI chain: providers in AI_PROVIDER_ORDER (default "gemini,claude") → server rule-based fallback → in-browser fallback when the API is unreachable.
- Skip a provider whose key is empty. Any error (no credits, 401/403/429/5xx, timeout, invalid JSON) → next provider. Never retry a 4xx.
- Storage chain: Firestore → localStorage.
- Every external call has a timeout (AI_TIMEOUT_MS per provider; Firestore 3s). Never a 500, never a blank screen, same response shape in every mode.
- Every API response includes mode: "gemini"|"claude"|"fallback" and store: "firestore"|"local". UI shows both as pills, plus "offline" when the browser can't reach the API.
- Money decisions ONLY in lib/engine.ts (pure TS, shared by server and browser). The LLM never decides.

## Domain
- Rule: {id, type, params, action: "block"|"ask", source: original sentence}
- Types: max_per_txn, daily_total_cap, category_daily_cap, ask_above, new_merchant, blocked_category, blocked_merchant, time_window
- Precedence BLOCK > ASK > APPROVE. Decision = {status, reasons[], ruleIds[]}
- PaymentRequest: {id, merchant, vpa, amount (INR integer), category, purpose, timestamp}
- Categories: food, travel, shopping, entertainment, bills, subscriptions, gambling, crypto, other

## Firebase / GCP
- Firestore via firebase-admin, server-side only, Application Default Credentials, project from GCP_PROJECT_ID. No client Firebase SDK, no key files.
- Data: wallets/demo (policy), wallets/demo/events (decisions).
- Deploy target: Cloud Run (Dockerfile, Next standalone, region asia-south1).

## Brand
"Kanakku Pulla". Deep green #0E3B2E, marigold #F2B33D, off-white #F7F7F2. Clean fintech UI, mobile-friendly.