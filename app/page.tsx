import type { Metadata } from "next";
import { Fraunces, Noto_Serif_Tamil } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Ambient } from "@/components/home/Ambient";
import { HeroFlow } from "@/components/home/HeroFlow";
import { Outcomes } from "@/components/home/Outcomes";
import "@/components/home/home.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", style: ["normal", "italic"], axes: ["SOFT", "opsz"] });
const tamil = Noto_Serif_Tamil({ subsets: ["tamil"], variable: "--font-tamil" });

export const metadata: Metadata = {
  title: "Kanakku Pulla: let AI agents pay, on your rules",
  description:
    "Kanakku Pulla sits between any AI agent and the payment gateway. Plain code approves, asks or blocks every payment before money moves.",
};

const MARIGOLD_BTN = "kp-btn bg-marigold text-brand";
const OUTLINE_BTN = "kp-btn border border-white/40 text-[#ECFDF4] hover:bg-white/10";
const TAMIL_NAME = "கணக்குப் புள்ள";

function Arrow() {
  return (
    <svg className="kp-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className={`kp-home ${display.variable} ${tamil.variable} flex min-h-screen flex-col overflow-x-clip`}>
      {/* If scripts never run, skip the draw-in so nothing stays invisible. */}
      <noscript>
        <style>{`.kp-draw{stroke-dashoffset:0}.kp-fade{opacity:1}`}</style>
      </noscript>

      <section className="kp-on-green relative isolate bg-brand text-[#ECFDF4]">
        <Ambient>
          <span className="kp-lines" />
          <span className="kp-blob kp-drift" />
          <span className="kp-blob kp-blob-b kp-drift" />
        </Ambient>

        <header className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <Link href="/" aria-label="Kanakku Pulla home" className="flex items-center gap-3 self-start rounded-lg md:self-auto">
            <Image src="/brand/mark.png" alt="" width={44} height={44} preload className="rounded-[22%] ring-1 ring-white/25" />
            <div>
              <p className="text-xl font-semibold leading-tight">Kanakku Pulla</p>
              <p className="text-xs text-[#B8C4C1]">Your AI agent&apos;s wallet, on your rules</p>
            </div>
          </Link>
          <nav aria-label="Main" className="flex items-center justify-between gap-4 md:justify-end">
            <a href="#how" className="inline-flex min-h-11 items-center text-sm font-semibold hover:underline">
              How it works
            </a>
            <Link href="/demo" className={MARIGOLD_BTN}>
              Try the live demo
              <Arrow />
            </Link>
          </nav>
        </header>

        <div className="mx-auto max-w-7xl px-4 pb-4 pt-8 lg:pt-14">
          <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
            <div>
              <p className="kp-rise text-xs font-semibold uppercase tracking-[0.22em] text-marigold">Agentic payments · India</p>
              <h1 className="kp-display mt-4 text-5xl font-medium leading-[1.02] tracking-tight md:text-7xl">
                <span className="kp-rise block" style={{ animationDelay: "90ms" }}>
                  Let AI agents pay.
                </span>
                <span className="kp-rise block italic text-marigold" style={{ animationDelay: "180ms" }}>
                  On your rules.
                </span>
              </h1>
            </div>
            <div className="kp-rise" style={{ animationDelay: "280ms" }}>
              <p className="text-base leading-relaxed">
                Kanakku Pulla sits between any AI agent and the payment gateway. You write rules in plain English; plain code
                approves, asks or blocks every payment before money moves.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/demo" className={MARIGOLD_BTN}>
                  Run the live demo
                  <Arrow />
                </Link>
                <a href="#how" className={OUTLINE_BTN}>
                  See how it works
                </a>
              </div>
            </div>
          </div>
          <div className="kp-rise mt-8 lg:mt-10" style={{ animationDelay: "380ms" }}>
            <HeroFlow />
          </div>
        </div>
      </section>

      <main className="flex-1">
        <section id="how" className="mx-auto max-w-7xl scroll-mt-6 px-4 pb-16 pt-32 md:pt-44">
          <div className="kp-reveal mb-8 grid items-end gap-3 md:grid-cols-2 md:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">How it works</p>
              <h2 className="kp-display mt-3 text-4xl font-medium leading-tight tracking-tight text-brand md:text-5xl">
                One check. <span className="italic">Three outcomes.</span>
              </h2>
            </div>
            <p className="text-base leading-relaxed">
              Every payment ends in exactly one lane. Block always beats Ask, and Ask beats Approve. The AI only reads your rules; it
              never decides a payment.
            </p>
          </div>
          <Outcomes />
        </section>

        <section className="kp-on-green relative isolate bg-brand">
          <Ambient>
            <span lang="ta" className="kp-tamil kp-watermark kp-drift">
              {TAMIL_NAME}
            </span>
          </Ambient>
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 py-14 md:flex-row md:items-center md:justify-between md:py-20">
            <h2 className="kp-display kp-reveal text-4xl font-medium leading-tight tracking-tight text-[#ECFDF4] md:text-5xl">
              See it decide <span className="italic text-marigold">in 30 seconds</span>
            </h2>
            <Link href="/demo" className={MARIGOLD_BTN}>
              Run the live demo
              <Arrow />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-5 text-sm">
          <Image src="/brand/mark.png" alt="Kanakku Pulla logo" width={32} height={32} className="rounded-[22%]" />
          <span lang="ta" className="kp-tamil font-semibold text-brand">
            {TAMIL_NAME}
          </span>
          <span className="text-[#737373]">Demo wallet · no real money</span>
        </div>
      </footer>
    </div>
  );
}
