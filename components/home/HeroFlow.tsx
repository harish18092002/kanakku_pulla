"use client";

import { useMemo, useState } from "react";
import { DiagramFrame, FlowEdge, FlowNode, PauseButton, Pill, TONE, type EdgeState, type Pt } from "./flow";
import { Icon, type IconName } from "./icons";
import { Ledger } from "./Ledger";
import { useDiagram, usePlayhead } from "./motion";
import { SAMPLES, rupees, type Sample } from "./samples";

const HOP = 900;
const NODES: { title: string; sub: string; icon: IconName }[] = [
  { title: "AI agent", sub: "Asks to pay", icon: "agent" },
  { title: "Kanakku Pulla", sub: "Checks your rules", icon: "shield" },
  { title: "Any PSP", sub: "Moves the money", icon: "bank" },
  { title: "Merchant", sub: "Gets paid", icon: "store" },
];

type Box = { x: number; y: number; w: number; h: number };
type Geometry = { viewBox: string; boxes: Box[]; edges: { from: Pt; to: Pt }[]; pill: Pt; chip: Pt; cap: Pt; layout: "row" | "col" };

const H_BOXES: Box[] = [
  { x: 0, y: 50, w: 120, h: 112 },
  { x: 220, y: 38, w: 150, h: 136 },
  { x: 470, y: 50, w: 120, h: 112 },
  { x: 700, y: 50, w: 120, h: 112 },
];
const V_BOXES: Box[] = [
  { x: 0, y: 8, w: 340, h: 66 },
  { x: 0, y: 122, w: 340, h: 80 },
  { x: 0, y: 250, w: 340, h: 66 },
  { x: 0, y: 364, w: 340, h: 66 },
];

const GEOMETRY: Record<"h" | "v", Geometry> = {
  h: {
    viewBox: "0 0 820 210",
    boxes: H_BOXES,
    edges: [0, 1, 2].map((i) => ({ from: { x: H_BOXES[i].x + H_BOXES[i].w, y: 106 }, to: { x: H_BOXES[i + 1].x, y: 106 } })),
    pill: { x: 295, y: 18 },
    chip: { x: 295, y: 193 },
    cap: { x: 390, y: 106 },
    layout: "col",
  },
  v: {
    viewBox: "0 0 340 438",
    boxes: V_BOXES,
    edges: [0, 1, 2].map((i) => ({ from: { x: 170, y: V_BOXES[i].y + V_BOXES[i].h }, to: { x: 170, y: V_BOXES[i + 1].y } })),
    pill: { x: 276, y: 122 },
    chip: { x: 258, y: 226 },
    cap: { x: 170, y: 222 },
    layout: "row",
  },
};

type Frame = {
  ms: number;
  edges: [EdgeState, EdgeState, EdgeState];
  token: number; // the edge showing the token
  say: string;
  ring?: boolean;
  decided?: boolean;
  waiting?: boolean;
  cap?: boolean;
};

const VERDICT: Record<Sample["status"], string> = {
  approve: "It fits every rule, so plain code approves it.",
  ask: "It crosses a rule that needs you, so it waits.",
  block: "It breaks a rule. The money never moves.",
};

function framesFor(sample: Sample): Frame[] {
  const asks = `The agent asks to pay ${sample.request.merchant} ${rupees(sample.request.amount)}.`;
  const verdict = VERDICT[sample.status];
  const wordsMs = sample.reason.split(" ").length * 70 + 500;
  const atGate: [EdgeState, EdgeState, EdgeState] = ["done", "idle", "idle"];
  const start: Frame[] = [
    { ms: 300, edges: ["idle", "idle", "idle"], token: 0, say: asks },
    { ms: HOP, edges: ["active", "idle", "idle"], token: 0, say: asks },
    { ms: 300, edges: atGate, token: 0, say: asks, ring: true },
    { ms: Math.max(1200, wordsMs), edges: atGate, token: 0, say: verdict, decided: true },
  ];
  if (sample.status === "block") return [...start, { ms: 2600, edges: atGate, token: 0, say: verdict, decided: true, cap: true }];
  const finish: Frame[] = [
    { ms: HOP, edges: ["done", "active", "idle"], token: 1, say: "Your PSP moves the money.", decided: true },
    { ms: HOP, edges: ["done", "done", "active"], token: 2, say: `${sample.request.merchant} gets paid.`, decided: true },
    { ms: 1700, edges: ["done", "done", "done"], token: 2, say: `${sample.request.merchant} gets paid.`, decided: true },
  ];
  if (sample.status === "approve") return [...start, ...finish];
  return [...start, { ms: 1800, edges: atGate, token: 0, say: "Waiting for your tap on the phone.", decided: true, waiting: true }, ...finish];
}

const ALL_LINES = [...new Set(SAMPLES.flatMap((s) => framesFor(s).map((f) => f.say)))];

function Stage({ variant }: { variant: "h" | "v" }) {
  const g = GEOMETRY[variant];
  const view = useDiagram(NODES.length);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const sample = SAMPLES[index];
  const frames = useMemo(() => framesFor(sample), [sample]);
  const durations = useMemo(() => frames.map((f) => f.ms), [frames]);
  const running = view.running && !paused;
  const step = usePlayhead(durations, {
    runKey: sample.status,
    running,
    instant: view.reduced,
    onEnd: () => setIndex((n) => (n + 1) % SAMPLES.length),
  });
  const frame = frames[Math.min(step, frames.length - 1)];
  const decided = Boolean(frame.decided);
  const gate = g.boxes[1];

  return (
    <>
      <div className="rounded-3xl border border-white/15 bg-[#0A2F24]/70 p-4 md:p-8">
        <DiagramFrame
          frameRef={view.ref}
          seen={view.seen}
          running={running}
          label={`A payment travels from the AI agent to Kanakku Pulla, then to any PSP and the merchant. Showing the outcome ${TONE[sample.status].word}.`}
          steps={SAMPLES.map((s) => `${s.request.merchant}, ${rupees(s.request.amount)}: ${TONE[s.status].word}. ${s.reason}. ${s.status === "block" ? "It stops at Kanakku Pulla." : "It continues to the PSP and the merchant."}`)}
        >
          <svg viewBox={g.viewBox} className="kp-svg mx-auto max-w-[1000px]">
            {NODES.map((n, i) => (
              <FlowNode key={n.title} {...g.boxes[i]} {...n} dark layout={g.layout} i={i} emphasis={i === 1} tone={i === 1 ? sample.status : undefined} tinted={i === 1 && decided} />
            ))}
            {g.edges.map((e, i) => (
              <FlowEdge key={i} {...e} dark state={frame.edges[i]} token={frame.token === i} i={i} />
            ))}
            {frame.ring && <rect x={gate.x} y={gate.y} width={gate.w} height={gate.h} rx={14} fill="none" stroke="#F2B33D" strokeWidth={2} className="kp-ring" />}
            <Pill {...g.pill} status={sample.status} on={decided} />
            <Pill {...g.chip} status="ask" word="Waiting for you" w={136} on={Boolean(frame.waiting)} />
            <g className="kp-pop" data-on={Boolean(frame.cap)}>
              <circle cx={g.cap.x} cy={g.cap.y} r={15} fill={TONE.block.fill} stroke={TONE.block.stroke} strokeWidth={2} />
              <Icon name="block" size={18} color={TONE.block.stroke} x={g.cap.x - 9} y={g.cap.y - 9} />
            </g>
          </svg>
          <div className="mt-3 grid text-center">
            {ALL_LINES.map((line) => (
              <p key={line} className="kp-display kp-tint col-start-1 row-start-1 text-lg italic text-[#ECFDF4] md:text-2xl" style={{ opacity: line === frame.say ? 1 : 0 }}>
                {line}
              </p>
            ))}
          </div>
        </DiagramFrame>
        {!view.reduced && (
          <div className="mt-2 flex justify-end md:-mt-10">
            <PauseButton dark paused={paused} onClick={() => setPaused((p) => !p)} />
          </div>
        )}
      </div>
      <Ledger current={sample} decided={decided} onPick={(s) => setIndex(SAMPLES.indexOf(s))} />
    </>
  );
}

export function HeroFlow() {
  return (
    <>
      <div className="hidden md:block">
        <Stage variant="h" />
      </div>
      <div className="md:hidden">
        <Stage variant="v" />
      </div>
    </>
  );
}
