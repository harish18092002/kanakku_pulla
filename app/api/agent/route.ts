import { readBody, reply, str } from "@/lib/api";
import { scriptedRequests } from "@/lib/fallback";
import { toRequests } from "@/lib/finish";
import { runAgent } from "@/lib/tasks";

// POST { task, search? } -> { requests: PaymentRequest[3..6], search, mode, store }. Always HTTP 200.
// search: true asks Gemini to use live Google Search (slower, ~10-15s); `search` in the reply says what was searched.
export async function POST(req: Request) {
  const body = await readBody(req);
  try {
    const result = await runAgent(str(body.task), body.search === true);
    return reply({ requests: result.requests, search: result.search }, result.mode);
  } catch (err) {
    console.error("[agent]", err instanceof Error ? err.name : "unknown error");
    return reply({ requests: toRequests(scriptedRequests("")), search: null }, "fallback");
  }
}
