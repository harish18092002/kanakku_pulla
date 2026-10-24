import { ruleLabel } from "@/lib/dashboard";
import type { Policy } from "@/lib/types";

type Props = {
  text: string;
  onText: (text: string) => void;
  onCompile: () => void;
  compiling: boolean;
  policy: Policy | null;
  warnings: string[];
};

const CHIP = {
  block: "border-red-200 bg-red-50 text-red-800",
  ask: "border-amber-300 bg-amber-50 text-amber-900",
};

export function RulesPanel({ text, onText, onCompile, compiling, policy, warnings }: Props) {
  const stale = policy !== null && policy.text !== text.trim();
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand">1 · Your rules</h2>
      <p className="mt-1 text-xs text-black/55">Write them in plain English, one sentence per rule.</p>
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        maxLength={2000}
        rows={8}
        className="mt-3 w-full resize-y rounded-lg border border-black/15 bg-[#fbfbf8] p-3 text-sm leading-relaxed outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onCompile}
          disabled={compiling}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#145241] disabled:opacity-60"
        >
          {compiling ? "Compiling…" : "Compile rules"}
        </button>
        {stale && <span className="text-xs text-amber-700">Rules changed. Compile to apply.</span>}
      </div>

      <div className="mt-4">
        {policy === null ? (
          <p className="text-xs text-black/45">Compiled rules show up here as chips.</p>
        ) : policy.rules.length === 0 ? (
          <p className="text-xs text-black/45">No rules found in that text.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {policy.rules.map((rule) => (
              <li
                key={rule.id}
                title={`“${rule.source}”`}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${CHIP[rule.action]}`}
              >
                <b className="text-[10px] uppercase tracking-wide">{rule.action}</b>
                {ruleLabel(rule)}
              </li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-amber-800">
            {warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
