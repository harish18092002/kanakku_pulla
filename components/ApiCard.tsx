"use client";

import { useEffect, useState } from "react";

const BODY = JSON.stringify({
  policy: {
    rules: [
      {
        id: "r1",
        type: "max_per_txn",
        params: { amount: 5000 },
        action: "block",
        source: "Never pay more than ₹5,000 in a single payment.",
      },
    ],
  },
  state: {},
  request: {
    id: "req_1",
    merchant: "Swiggy",
    vpa: "swiggy@icici",
    amount: 6200,
    category: "food",
    purpose: "Party order",
    timestamp: "2026-10-24T14:00:00.000Z",
  },
});

export function ApiCard() {
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(t);
  }, []);

  const curl = `curl -X POST ${origin}/api/authorize \\\n  -H 'content-type: application/json' \\\n  -d '${BODY}'`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the text is still selectable
    }
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand">Use it from any agent</h2>
          <p className="mt-1 text-xs text-black/55">
            <code className="rounded bg-black/5 px-1">POST /api/authorize</code> returns approve, ask or block. The
            decision comes from the rules engine, never from an LLM.
          </p>
        </div>
        <button
          onClick={copy}
          className="shrink-0 rounded-lg border border-black/20 px-3 py-1.5 text-xs font-semibold text-black/70 hover:bg-black/5"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-brand p-3 text-xs leading-relaxed text-emerald-50">{curl}</pre>
    </section>
  );
}
