"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduce(onChange: () => void) {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function subscribeTab(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

const DRAW_MS = 700;
const FADE_MS = 300;
const STAGGER_MS = 60;

/** Starts the draw-in at 40% visible and reports whether a diagram's timeline may run. */
export function useDiagram(nodeCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
  const tabVisible = useSyncExternalStore(subscribeTab, () => document.visibilityState === "visible", () => true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry.isIntersecting);
        // A diagram taller than the screen can never reach a 40% ratio, so 40% of the screen also counts.
        const viewport = entry.rootBounds?.height ?? window.innerHeight;
        if (entry.intersectionRatio >= 0.4 || entry.intersectionRect.height >= viewport * 0.4) setSeen(true);
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    const t = setTimeout(() => setDrawn(true), reduced ? 0 : DRAW_MS + nodeCount * STAGGER_MS + FADE_MS);
    return () => clearTimeout(t);
  }, [seen, reduced, nodeCount]);

  return { ref, seen, reduced, running: drawn && onScreen && tabVisible };
}

type PlayOptions = { runKey: string; running: boolean; instant: boolean; onEnd?: () => void };

/** Steps through `durations`, keeping the time left when paused. Returns durations.length at the end. */
export function usePlayhead(durations: number[], { runKey, running, instant, onEnd }: PlayOptions) {
  const [pos, setPos] = useState({ key: runKey, step: 0 });
  const step = pos.key === runKey ? pos.step : 0;
  const paused = useRef<{ key: string; step: number; ms: number } | null>(null);
  const endRef = useRef(onEnd);

  useEffect(() => {
    endRef.current = onEnd;
  });

  useEffect(() => {
    if (instant || !running || step >= durations.length) return;
    const saved = paused.current;
    const ms = saved && saved.key === runKey && saved.step === step ? saved.ms : durations[step];
    const startedAt = performance.now();
    const t = setTimeout(() => {
      paused.current = null;
      setPos({ key: runKey, step: step + 1 });
      if (step + 1 >= durations.length) endRef.current?.();
    }, ms);
    return () => {
      clearTimeout(t);
      paused.current = { key: runKey, step, ms: Math.max(0, ms - (performance.now() - startedAt)) };
    };
  }, [durations, instant, runKey, running, step]);

  return instant ? durations.length : step;
}
