import { inr, type UiMode } from "@/lib/dashboard";
import type { PaymentRequest, SearchInfo } from "@/lib/types";

export type SuggestionData = {
  requests: PaymentRequest[];
  search: SearchInfo | null; // set only when the answer came from a live web search
  mode: UiMode;
  asked: boolean; // the user asked for live search
};

export function Suggestions({ data }: { data: SuggestionData | null }) {
  if (!data) return null;
  const { requests, search, mode, asked } = data;
  const ai = mode === "gemini" || mode === "claude";

  const badge = search
    ? { label: "Live web search", cls: "bg-emerald-700 text-white" }
    : ai
      ? { label: "AI suggestions", cls: "bg-sky-100 text-sky-900" }
      : { label: "Built-in samples", cls: "bg-amber-100 text-amber-900" };
  const note = search
    ? null
    : ai
      ? asked && "Live search wasn't available, so the AI suggested these without searching the web."
      : mode === "offline"
        ? "Can't reach the server, so these are built-in sample payments."
        : "The AI didn't answer in time, so these are built-in sample payments.";

  return (
    <div className="mt-4 border-t border-black/10 pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-black/60">Agent suggestions</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
      </div>
      {note && <p className="mt-2 text-xs text-amber-800">{note}</p>}

      <ul className="mt-2 divide-y divide-black/5 rounded-lg border border-black/10 bg-[#fbfbf8]">
        {requests.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.merchant}</p>
              <p className="truncate text-xs text-black/50">{r.purpose || r.category}</p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{inr(r.amount)}</span>
          </li>
        ))}
      </ul>

      {search && search.queries.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-black/45">Searched for</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {search.queries.map((q) => (
              <li key={q} className="rounded-full bg-brand/5 px-2.5 py-0.5 text-xs text-brand">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
      {search && search.sources.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-black/45">Sources</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {search.sources.map((s) => (
              <li key={s.url} className="truncate">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
