import { readBody, reply, str } from "@/lib/api";
import { compilePolicy } from "@/lib/tasks";

// POST { text } -> { policy, warnings, mode, store }. Always HTTP 200.
export async function POST(req: Request) {
  const body = await readBody(req);
  try {
    const { policy, warnings, mode } = await compilePolicy(str(body.text));
    return reply({ policy, warnings }, mode);
  } catch (err) {
    console.error("[compile]", err instanceof Error ? err.name : "unknown error");
    return reply({ policy: { rules: [], text: "" }, warnings: ["Could not compile those rules."] }, "fallback");
  }
}
