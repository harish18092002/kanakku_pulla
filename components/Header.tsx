import Image from "next/image";
import Link from "next/link";
import { inr, type UiMode } from "@/lib/dashboard";
import { CATEGORIES, type Store, type WalletState } from "@/lib/types";

const MODE_PILL: Record<UiMode, { label: string; cls: string }> = {
  gemini: { label: "Gemini", cls: "bg-sky-100 text-sky-900" },
  claude: { label: "Claude", cls: "bg-orange-100 text-orange-900" },
  fallback: { label: "Fallback", cls: "bg-white/90 text-brand" },
  offline: { label: "Offline", cls: "bg-red-100 text-red-800" },
};

type Props = { balance: number; wallet: WalletState; mode: UiMode | null; store: Store };

export function Header({ balance, wallet, mode, store }: Props) {
  const spend = CATEGORIES.map((c) => [c, wallet.spentByCategory[c] ?? 0] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = spend[0]?.[1] ?? 1;
  const pill = mode ? MODE_PILL[mode] : null;

  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <Link
          href="/"
          aria-label="Kanakku Pulla home"
          className="flex items-center gap-3 self-start rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marigold md:self-auto"
        >
          <Image
            src="/brand/mark.png"
            alt=""
            width={44}
            height={44}
            priority
            className="rounded-[22%] ring-1 ring-white/25"
          />
          <div>
            <h1 className="text-xl font-semibold leading-tight">Kanakku Pulla</h1>
            <p className="text-xs text-white/70">Your AI agent&apos;s wallet, on your rules</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Wallet balance</p>
            <p className="text-2xl font-bold tabular-nums">{inr(balance)}</p>
          </div>
          <div className="min-w-56 flex-1">
            <p className="text-xs uppercase tracking-wide text-white/60">
              Spent today <span className="font-semibold text-marigold">{inr(wallet.spentToday)}</span>
            </p>
            {spend.length === 0 ? (
              <p className="mt-1 text-sm text-white/50">Nothing spent yet</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {spend.map(([category, value]) => (
                  <li key={category} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                    <span className="capitalize text-white/80">{category}</span>
                    <span className="h-2 rounded-full bg-white/15">
                      <span
                        className="block h-2 rounded-full bg-marigold transition-all"
                        style={{ width: `${Math.max(6, (value / max) * 100)}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums">{inr(value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-2 text-xs font-semibold">
            <span className={`rounded-full px-3 py-1 ${pill?.cls ?? "bg-white/10 text-white/60"}`}>
              {pill ? pill.label : "No AI call yet"}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
              {store === "firestore" ? "Firestore" : "Local"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
