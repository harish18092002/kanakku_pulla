import { inr, type FeedItem, type FeedStatus } from "@/lib/dashboard";

const TONE: Record<FeedStatus, { label: string; card: string; badge: string }> = {
  approved: { label: "APPROVED", card: "border-emerald-300 bg-emerald-50", badge: "bg-emerald-700 text-white" },
  approved_by_you: { label: "APPROVED BY YOU", card: "border-emerald-300 bg-emerald-50", badge: "bg-emerald-700 text-white" },
  blocked: { label: "BLOCKED", card: "border-red-300 bg-red-50", badge: "bg-red-600 text-white" },
  denied_by_you: { label: "DENIED BY YOU", card: "border-red-300 bg-red-50", badge: "bg-red-600 text-white" },
  pending: { label: "NEEDS YOU", card: "border-amber-400 bg-amber-50", badge: "bg-marigold text-brand" },
};

type Props = { items: FeedItem[]; onResolve: (id: string, approve: boolean) => void };

export function Feed({ items, onResolve }: Props) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand">3 · Live feed</h2>
      {items.length === 0 ? (
        <p className="mt-6 pb-6 text-center text-sm text-black/45">
          No payments yet. Run the agent or the full demo.
        </p>
      ) : (
        <ul className="mt-3 space-y-3 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
          {items.map(({ request, status, reasons }) => {
            const tone = TONE[status];
            return (
              <li key={request.id} className={`card-in rounded-xl border p-3 ${tone.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${tone.badge}`}>
                      {tone.label}
                    </span>
                    <p className="mt-1.5 truncate font-semibold">{request.merchant}</p>
                    <p className="text-xs capitalize text-black/60">
                      {request.category}
                      {request.purpose && <span className="normal-case"> · {request.purpose}</span>}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{inr(request.amount)}</p>
                </div>

                <ul className="mt-2 space-y-1.5 text-xs text-black/75">
                  {reasons.map((r, i) => (
                    <li key={i}>
                      {r.text}
                      {r.source && <q className="mt-0.5 block italic text-black/50">{r.source}</q>}
                    </li>
                  ))}
                </ul>

                {status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onResolve(request.id, true)}
                      className="flex-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#145241]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onResolve(request.id, false)}
                      className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
