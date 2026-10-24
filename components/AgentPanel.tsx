import type { ReactNode } from "react";

type Props = {
  task: string;
  onTask: (task: string) => void;
  live: boolean;
  onLive: (live: boolean) => void;
  busy: "agent" | "demo" | null;
  note: string;
  onRun: () => void;
  onDemo: () => void;
  onReset: () => void;
  children?: ReactNode;
};

export function AgentPanel({ task, onTask, live, onLive, busy, note, onRun, onDemo, onReset, children }: Props) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand">2 · The agent</h2>
      <p className="mt-1 text-xs text-black/55">Give it a task. Every payment it tries is checked against your rules.</p>
      <input
        value={task}
        onChange={(e) => onTask(e.target.value)}
        maxLength={500}
        placeholder="e.g. Book a cab and order dinner"
        className="mt-3 w-full rounded-lg border border-black/15 bg-[#fbfbf8] px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-black/65">
        <input
          type="checkbox"
          checked={live}
          onChange={(e) => onLive(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#0E3B2E]"
        />
        <span>
          <b className="text-brand">Search the web live</b> for real merchants and prices. Slower: 10–20 seconds.
        </span>
      </label>
      <button
        onClick={onRun}
        disabled={busy !== null}
        className="mt-2 w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#145241] disabled:opacity-60"
      >
        {busy === "agent" ? (live ? "Searching the web…" : "Agent is working…") : "Run agent"}
      </button>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          onClick={onDemo}
          disabled={busy !== null}
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-brand transition hover:brightness-95 disabled:opacity-60"
        >
          {busy === "demo" ? "Scenario running…" : "Run sample scenario"}
        </button>
        <button
          onClick={onReset}
          className="rounded-lg border border-black/20 px-4 py-2 text-sm font-semibold text-black/70 transition hover:bg-black/5"
        >
          Reset
        </button>
      </div>
      <p className="mt-2 text-xs text-black/50">
        The sample scenario replaces your rules with the sample ones, clears the wallet and feed, then sends 8 fixed
        payments, one per second.
      </p>
      {note && <p className="mt-3 rounded-lg bg-brand/5 px-3 py-2 text-xs text-brand">{note}</p>}
      {children}
    </section>
  );
}
