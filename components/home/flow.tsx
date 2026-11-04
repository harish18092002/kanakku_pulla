"use client";

import { useId, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Icon, type IconName } from "./icons";
import type { Status } from "./samples";

export const GREEN = "#0E3B2E";
export const INK = "#14201B";
export const MARIGOLD = "#F2B33D";
export const ON_GREEN = "#ECFDF4";
const MUTED_ON_GREEN = "#B8C4C1";
const MUTED = "#737373";

// Words on these tints stay in INK: #B67A06 and #1E7F52 fall below 4.5:1 as small text, so they colour icons and strokes.
export const TONE: Record<Status, { stroke: string; fill: string; word: string; icon: IconName }> = {
  approve: { stroke: "#1E7F52", fill: "#E4F0EA", word: "Approve", icon: "approve" },
  ask: { stroke: "#B67A06", fill: "#FDF4E4", word: "Ask you", icon: "ask" },
  block: { stroke: "#B63A2B", fill: "#F6E8E6", word: "Block", icon: "block" },
};

export type Pt = { x: number; y: number };
export type EdgeState = "idle" | "active" | "done";

type NodeProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  icon: IconName;
  tone?: Status;
  tinted?: boolean;
  dark?: boolean; // glass tile for the green stage
  emphasis?: boolean; // the Kanakku Pulla gate
  layout?: "row" | "col";
  i?: number;
};

type ContentColors = { icon: string; title: string; sub: string };

function NodeContent({ x, y, w, h, title, sub, icon, emphasis, layout = "row", colors }: NodeProps & { colors: ContentColors }) {
  if (layout === "col") {
    const size = emphasis ? 38 : 30;
    const top = y + (emphasis ? 22 : 16);
    const titleY = top + size + 24;
    return (
      <>
        <Icon name={icon} size={size} color={colors.icon} x={x + w / 2 - size / 2} y={top} />
        <text x={x + w / 2} y={titleY} textAnchor="middle" fontSize={emphasis ? 15 : 14} fontWeight={600} fill={colors.title}>
          {title}
        </text>
        {sub && (
          <text x={x + w / 2} y={titleY + 19} textAnchor="middle" fontSize={12} fill={colors.sub}>
            {sub}
          </text>
        )}
      </>
    );
  }
  const mid = y + h / 2;
  return (
    <>
      <Icon name={icon} size={22} color={colors.icon} x={x + 12} y={mid - 11} />
      <text x={x + 42} y={sub ? mid - 3 : mid + 5} fontSize={13.5} fontWeight={600} fill={colors.title}>
        {title}
      </text>
      {sub && (
        <text x={x + 42} y={mid + 14} fontSize={11.5} fill={colors.sub}>
          {sub}
        </text>
      )}
    </>
  );
}

export function FlowNode(p: NodeProps) {
  const { x, y, w, h, tone, tinted, dark, emphasis, layout = "row", i = 0 } = p;
  const t = tone ? TONE[tone] : null;
  const base: ContentColors = dark
    ? { icon: emphasis ? MARIGOLD : ON_GREEN, title: ON_GREEN, sub: MUTED_ON_GREEN }
    : { icon: GREEN, title: GREEN, sub: INK };
  const box = { x, y, width: w, height: h, rx: 14 };
  const spinX = layout === "col" ? x + w / 2 : x + 23;
  const spinY = layout === "col" ? y + 41 : y + h / 2;
  return (
    <g className="kp-fade" style={{ "--i": i } as CSSProperties}>
      <rect {...box} fill={dark ? "#1A4D3E" : "#fff"} stroke={dark ? (emphasis ? MARIGOLD : "#4A7265") : "#E5E5E5"} strokeWidth={emphasis ? 1.5 : 1} />
      <NodeContent {...p} colors={base} />
      {t && (
        <g className="kp-tint" style={{ opacity: tinted ? 1 : 0 }}>
          <rect {...box} fill={t.fill} stroke={t.stroke} strokeWidth={1.5} />
          <NodeContent {...p} colors={{ icon: t.stroke, title: INK, sub: INK }} />
        </g>
      )}
      {emphasis && dark && (
        <circle cx={spinX} cy={spinY} r={layout === "col" ? 30 : 16} fill="none" stroke={MARIGOLD} strokeWidth={1.25} strokeDasharray="2 6" strokeLinecap="round" className="kp-spin" />
      )}
    </g>
  );
}

function Trail({ at, on, delay, r }: { at: Pt; on: boolean; delay: number; r: number }) {
  const style = { transform: `translate(${at.x}px, ${at.y}px)`, opacity: on ? 0.35 : 0, transitionDelay: `${delay}ms` };
  return (
    <g className="kp-token" style={style}>
      <circle r={r} fill={MARIGOLD} />
    </g>
  );
}

export function Token({ at, on }: { at: Pt; on: boolean }) {
  return (
    <g className="kp-token" style={{ transform: `translate(${at.x}px, ${at.y}px)`, opacity: on ? 1 : 0 }}>
      <circle r={19} fill={MARIGOLD} opacity={0.22} />
      <circle r={12} fill={MARIGOLD} stroke={GREEN} strokeWidth={1.5} />
      <text y={4.8} textAnchor="middle" fontSize={14} fontWeight={700} fill={GREEN}>
        ₹
      </text>
    </g>
  );
}

type EdgeProps = {
  from: Pt;
  to: Pt;
  state: EdgeState;
  tone?: Status;
  dark?: boolean;
  /** Shows the ₹ token. It rests at `from` when idle and travels to `to` when active. */
  token: boolean;
  i?: number;
};

export function FlowEdge({ from, to, state, tone, dark, token, i = 0 }: EdgeProps) {
  const id = `kp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const color = dark ? MARIGOLD : tone ? TONE[tone].stroke : GREEN;
  const d = `M${from.x} ${from.y}L${to.x} ${to.y}`;
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const at = state === "idle" ? from : to;
  return (
    <g className="kp-edge" data-state={state}>
      {/* A straight line has an empty bounding box, so the mask must use user space. */}
      <mask id={id} maskUnits="userSpaceOnUse" x={-100} y={-100} width={3000} height={3000}>
        <path d={d} pathLength={1} className="kp-draw" fill="none" stroke="#fff" strokeWidth={6} />
      </mask>
      <path d={d} mask={`url(#${id})`} className="kp-dash" fill="none" stroke={dark ? MUTED_ON_GREEN : tone ? color : MUTED} strokeWidth={1.5} strokeDasharray="6 4" />
      <path d={d} pathLength={1} className="kp-solid" fill="none" stroke={color} strokeWidth={2.5} />
      <path d="M-8 -5L0 0L-8 5Z" fill={dark ? MUTED_ON_GREEN : color} className="kp-fade" style={{ "--i": i } as CSSProperties} transform={`translate(${to.x} ${to.y}) rotate(${angle})`} />
      <Trail at={at} on={token && state === "active"} delay={110} r={5} />
      <Trail at={at} on={token && state === "active"} delay={55} r={8} />
      <Token at={at} on={token} />
    </g>
  );
}

/** A pop-in pill: status colour always comes with an icon and a word. */
export function Pill({ x, y, status, word, w = 92, on }: { x: number; y: number; status: Status; word?: string; w?: number; on: boolean }) {
  const t = TONE[status];
  return (
    <g className="kp-pop" data-on={on}>
      <rect x={x - w / 2} y={y - 14} width={w} height={28} rx={14} fill={t.fill} stroke={t.stroke} strokeWidth={1.5} />
      <Icon name={t.icon} size={16} color={t.stroke} x={x - w / 2 + 8} y={y - 8} />
      <text x={x - w / 2 + 28} y={y + 4.5} fontSize={12.5} fontWeight={700} fill={INK}>
        {word ?? t.word}
      </text>
    </g>
  );
}

export function PauseButton({ paused, dark, onClick }: { paused: boolean; dark?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={paused ? "Play the animation" : "Pause the animation"}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition ${
        dark ? "border-white/25 text-[#ECFDF4] hover:bg-white/10" : "border-black/15 text-brand hover:bg-brand/5"
      }`}
    >
      <Icon name={paused ? "play" : "pause"} size={16} />
    </button>
  );
}

type FrameProps = {
  frameRef: RefObject<HTMLDivElement | null>;
  seen: boolean;
  running: boolean;
  label: string;
  steps: string[];
  children: ReactNode;
};

/** role="img" diagram plus a visually hidden ordered list of its steps. Keep controls outside it. */
export function DiagramFrame({ frameRef, seen, running, label, steps, children }: FrameProps) {
  return (
    <div ref={frameRef} data-seen={seen} data-paused={!running}>
      <div role="img" aria-label={label}>
        {children}
      </div>
      <ol className="sr-only">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
