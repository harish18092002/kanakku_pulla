import type { Mode, Store } from "./types";

// Firestore isn't wired to these routes yet, so state lives in the browser.
export const STORE: Store = "local";

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Every API response carries `mode` and `store`, always with HTTP 200. */
export function reply<T extends object>(data: T, mode: Mode): Response {
  return Response.json({ ...data, mode, store: STORE }, { headers: { "Cache-Control": "no-store" } });
}
