"use client";

import { TONE } from "./flow";
import { Icon } from "./icons";
import { RULE_LINES, SAMPLES, isHit, rupees, type Sample } from "./samples";

// The accountant's page: your plain-English rules on the left, the entry being stamped on the right.

function RuleLine({ line, index, current, decided }: { line: string; index: number; current: Sample; decided: boolean }) {
  const hit = isHit(current, line);
  const passed = current.status === "approve";
  const t = TONE[passed ? "approve" : current.status];
  const marked = decided && (hit || passed);
  return (
    <li className="relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm">
      <span className="kp-tint absolute inset-0 rounded-lg" style={{ backgroundColor: t.fill, opacity: decided && hit ? 1 : 0 }} />
      <span className="relative grid h-5 w-5 shrink-0 place-items-center">
        <span className="col-start-1 row-start-1 h-1.5 w-1.5 rounded-full bg-black/25" />
        <span className="kp-pop col-start-1 row-start-1 bg-white" data-on={marked} style={{ transitionDelay: marked && passed ? `${index * 70}ms` : "0ms" }}>
          <Icon name={t.icon} size={20} color={t.stroke} />
        </span>
      </span>
      <span className="relative">{line}</span>
    </li>
  );
}

function Slip({ sample, shown, decided }: { sample: Sample; shown: boolean; decided: boolean }) {
  const { request, reason, status } = sample;
  const t = TONE[status];
  const on = shown && decided;
  return (
    <div className="relative col-start-1 row-start-1 pb-16" style={{ visibility: shown ? "visible" : "hidden" }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="kp-display text-3xl text-brand">{request.merchant}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-brand">{rupees(request.amount)}</p>
      </div>
      <p className="mt-0.5 text-sm text-[#737373]">
        <span className="capitalize">{request.category}</span> · {request.purpose}
      </p>
      <p className="mt-3 text-base leading-snug" data-on={on}>
        {reason.split(" ").map((word, i) => (
          <span key={`${word}${i}`} className="kp-word" style={{ transitionDelay: on ? `${i * 70}ms` : "0ms" }}>
            {word}{" "}
          </span>
        ))}
      </p>
      <div className="kp-stamp absolute bottom-1 right-1" data-on={on} style={{ color: t.stroke, borderColor: t.stroke }}>
        <Icon name={t.icon} size={20} color={t.stroke} />
        {t.word.toUpperCase()}
      </div>
    </div>
  );
}

type Props = { current: Sample; decided: boolean; onPick: (s: Sample) => void };

export function Ledger({ current, decided, onPick }: Props) {
  return (
    <div className="kp-paper relative z-10 -mb-20 mt-5 grid gap-6 rounded-3xl p-5 text-[#14201B] md:-mb-28 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 md:p-8">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Your rules, in your words</h2>
        <ul className="mt-3 space-y-0.5">
          {RULE_LINES.map((line, i) => (
            <RuleLine key={line} line={line} index={i} current={current} decided={decided} />
          ))}
        </ul>
      </div>
      <div className="md:border-l-2 md:border-marigold md:pl-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Ledger entry</h2>
        <div className="mt-3 grid">
          {SAMPLES.map((s) => (
            <Slip key={s.status} sample={s} shown={s === current} decided={decided} />
          ))}
        </div>
        <div role="group" aria-label="Choose a sample payment" className="mt-2 grid grid-cols-3 gap-2">
          {SAMPLES.map((s) => {
            const t = TONE[s.status];
            const on = s === current;
            return (
              <button
                key={s.status}
                type="button"
                aria-pressed={on}
                onClick={() => onPick(s)}
                style={on ? { backgroundColor: t.fill, borderColor: t.stroke } : undefined}
                className="min-h-11 min-w-0 rounded-xl border border-black/15 bg-white px-1.5 py-1.5 text-left transition hover:-translate-y-0.5 md:px-2"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon name={t.icon} size={16} color={t.stroke} className="shrink-0" />
                  {t.word}
                </span>
                <span className="mt-0.5 block whitespace-nowrap text-[11px] tabular-nums md:text-xs">
                  {s.request.merchant} {rupees(s.request.amount)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
