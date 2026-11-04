"use client";

import { useState } from "react";
import { DiagramFrame, FlowEdge, FlowNode, PauseButton, type EdgeState, type Pt } from "./flow";
import type { IconName } from "./icons";
import { useDiagram, usePlayhead } from "./motion";
import type { Status } from "./samples";

const HOP = 900;
type Item = { title: string; sub: string; icon: IconName; col: number };
const LANES: { status: Status; items: Item[]; text: string }[] = [
  {
    status: "approve",
    text: "Approve, then any PSP moves the money, then the merchant is paid.",
    items: [
      { title: "Approve", sub: "Within your rules", icon: "approve", col: 0 },
      { title: "Any PSP", sub: "Moves the money", icon: "bank", col: 2 },
      { title: "Merchant paid", sub: "Receipt sent", icon: "store", col: 3 },
    ],
  },
  {
    status: "ask",
    text: "Ask you, then approval on your phone by tap or UPI PIN, then any PSP, then the merchant is paid.",
    items: [
      { title: "Ask you", sub: "Needs your OK", icon: "ask", col: 0 },
      { title: "Your phone", sub: "Tap or UPI PIN", icon: "phone", col: 1 },
      { title: "Any PSP", sub: "Moves the money", icon: "bank", col: 2 },
      { title: "Merchant paid", sub: "Receipt sent", icon: "store", col: 3 },
    ],
  },
  {
    status: "block",
    text: "Block, then the agent is told why, and nothing is paid.",
    items: [
      { title: "Block", sub: "Breaks a rule", icon: "block", col: 0 },
      { title: "Agent told why", sub: "Quotes your rule", icon: "chat", col: 1 },
      { title: "Nothing paid", sub: "No money moves", icon: "block", col: 2 },
    ],
  },
];

const GUARD = { title: "Guardrails", sub: "Plain code", icon: "shield" as const };
const NODE_COUNT = 1 + LANES.reduce((n, l) => n + l.items.length, 0);

type Box = { x: number; y: number; w: number; h: number };
type Placed = { box: Box; in: Pt; out: Pt }[][];

// Desktop: a fan from the left into three rows, with the PSP and merchant aligned in columns.
const H = { w: 146, h: 68, cols: [170, 338, 506, 674], rows: [0, 92, 184] };
const hPlaced: Placed = LANES.map((lane, l) =>
  lane.items.map((item) => {
    const box = { x: H.cols[item.col], y: H.rows[l], w: H.w, h: H.h };
    return { box, in: { x: box.x, y: box.y + H.h / 2 }, out: { x: box.x + H.w, y: box.y + H.h / 2 } };
  }),
);

// Phone: a spine down the left margin branches into three stacked lanes.
const SPINE_X = 20;
const V = { x: 52, w: 288, h: 58, gap: 26, laneGap: 34, top: 92 };
function placeVertical(): Placed {
  let y = V.top;
  return LANES.map((lane) => {
    const placed = lane.items.map(() => {
      const box = { x: V.x, y, w: V.w, h: V.h };
      y += V.h + V.gap;
      return { box, in: { x: V.x + V.w / 2, y: box.y }, out: { x: V.x + V.w / 2, y: box.y + V.h } };
    });
    y += V.laneGap - V.gap;
    return placed;
  });
}
const vPlaced = placeVertical();
const vHeight = vPlaced[2][2].box.y + V.h;

const LAYOUT = {
  h: { viewBox: "0 0 820 252", guard: { x: 0, y: 84, w: 120, h: 84 }, origin: { x: 120, y: 126 }, placed: hPlaced },
  v: { viewBox: `0 0 340 ${vHeight}`, guard: { x: 0, y: 0, w: 340, h: 62 }, origin: { x: SPINE_X, y: 62 }, placed: vPlaced },
};

// Each lane plays in turn: a rest beat, one hop per edge, then a hold.
const TIMELINE = LANES.flatMap((lane, l) => [
  { lane: l, hop: -1, ms: 300 },
  ...lane.items.map((_, hop) => ({ lane: l, hop, ms: HOP })),
  { lane: l, hop: lane.items.length, ms: 1000 },
]);
const DURATIONS = TIMELINE.map((t) => t.ms);

function Diagram({ variant }: { variant: "h" | "v" }) {
  const g = LAYOUT[variant];
  const view = useDiagram(NODE_COUNT);
  const [lap, setLap] = useState(0);
  const [paused, setPaused] = useState(false);
  const running = view.running && !paused;
  const step = usePlayhead(DURATIONS, {
    runKey: String(lap),
    running,
    instant: view.reduced,
    onEnd: () => setLap((n) => n + 1),
  });
  const now = step >= TIMELINE.length ? { lane: LANES.length, hop: 0 } : TIMELINE[step];
  const edgeState = (l: number, hop: number): EdgeState => {
    if (l < now.lane || (l === now.lane && hop < now.hop)) return "done";
    return l === now.lane && hop === now.hop ? "active" : "idle";
  };

  return (
    <>
      <DiagramFrame
        frameRef={view.ref}
        seen={view.seen}
        running={running}
        label="Fan-out from Guardrails into three lanes: Approve, Ask you and Block. Only Approve and Ask you lead to a paid merchant."
        steps={LANES.map((l) => l.text)}
      >
        <svg viewBox={g.viewBox} className="kp-svg">
          {variant === "v" && <path d={`M${SPINE_X} 62V${vPlaced[2][0].box.y + V.h / 2}`} pathLength={1} className="kp-draw" fill="none" stroke="#737373" strokeWidth={1.5} />}
          <FlowNode {...g.guard} {...GUARD} dark emphasis i={0} />
          {LANES.map((lane, l) =>
            lane.items.map((item, k) => {
              const reached = l < now.lane || (l === now.lane && k < now.hop);
              return <FlowNode key={item.title + l} {...g.placed[l][k].box} {...item} tone={lane.status} tinted={k === 0 || reached} i={1 + l * 3 + k} />;
            }),
          )}
          {LANES.map((lane, l) =>
            lane.items.map((item, k) => {
              const laneMid = g.placed[l][0].box.y + V.h / 2;
              const from = k > 0 ? g.placed[l][k - 1].out : variant === "v" ? { x: SPINE_X, y: laneMid } : g.origin;
              const to = k === 0 && variant === "v" ? { x: V.x, y: laneMid } : g.placed[l][k].in;
              const state = edgeState(l, k);
              // A blocked payment stops at the Block node: later edges carry the message, not the ₹ token.
              const token = state === "active" && (lane.status !== "block" || k === 0);
              return <FlowEdge key={item.title + l} from={from} to={to} state={state} tone={lane.status} token={token} i={l + k} />;
            }),
          )}
        </svg>
      </DiagramFrame>
      {!view.reduced && (
        <div className="mt-2 flex justify-end">
          <PauseButton paused={paused} onClick={() => setPaused((p) => !p)} />
        </div>
      )}
    </>
  );
}

export function Outcomes() {
  return (
    <div className="kp-lift rounded-3xl border border-black/10 bg-white p-4 md:p-8">
      <div className="hidden md:block">
        <Diagram variant="h" />
      </div>
      <div className="md:hidden">
        <Diagram variant="v" />
      </div>
    </div>
  );
}
