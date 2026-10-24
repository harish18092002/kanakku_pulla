import { readBody, reply, str } from "@/lib/api";
import { scriptedRequests } from "@/lib/fallback";
import { toRequests } from "@/lib/finish";
import { runAgent } from "@/lib/tasks";

// POST { task } -> { requests: PaymentRequest[3..6], mode, store }. Always HTTP 200.
export async function POST(req: Request) {
  const body = await readBody(req);
  try {
    const { requests, mode } = await runAgent(str(body.task));
    return reply({ requests }, mode);
  } catch (err) {
    console.error("[agent]", err instanceof Error ? err.name : "unknown error");
    return reply({ requests: toRequests(scriptedRequests("")) }, "fallback");
  }
}
