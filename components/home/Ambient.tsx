"use client";

import type { ReactNode } from "react";
import { useDiagram } from "./motion";

/** Decorative background layer. Its slow drift pauses when off-screen or when the tab is hidden. */
export function Ambient({ children }: { children: ReactNode }) {
  const { ref, running } = useDiagram(0);
  return (
    <div ref={ref} aria-hidden="true" data-paused={!running} className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {children}
    </div>
  );
}
