"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Plays the logo clip once per browser session, then fades into the dashboard.
// Skippable, and never blocks: autoplay refusal, load errors, reduced-motion and a hard time limit all dismiss it.

const SEEN_KEY = "kanakku:splash-seen";
const MAX_MS = 8000; // the clip is ~6s

export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const video = useRef<HTMLVideoElement>(null);

  const finish = useCallback(() => {
    setPhase((p) => (p === "show" ? "fade" : p));
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage blocked: the clip may replay on refresh, which is fine
    }
  }, []);

  useEffect(() => {
    let skip = false;
    try {
      skip =
        sessionStorage.getItem(SEEN_KEY) === "1" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // treat as first visit
    }
    const start = setTimeout(() => {
      if (skip) setPhase("gone");
      else video.current?.play().catch(finish); // autoplay blocked -> don't trap the user
    }, 0);
    const limit = setTimeout(finish, MAX_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(limit);
    };
  }, [finish]);

  useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => setPhase("gone"), 500);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div
      aria-label="Kanakku Pulla intro"
      className={`fixed inset-0 z-50 grid place-items-center bg-[#f7f7f2] transition-opacity duration-500 ${
        phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={video}
        src="/brand/logo.mp4"
        poster="/brand/logo.png"
        muted
        autoPlay
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        className="aspect-square w-[min(92vw,70vh,560px)]"
      />
      <button
        onClick={finish}
        className="absolute bottom-6 right-6 rounded-full border border-brand/30 bg-white/70 px-4 py-1.5 text-sm font-medium text-brand backdrop-blur hover:bg-white"
      >
        Skip
      </button>
    </div>
  );
}
