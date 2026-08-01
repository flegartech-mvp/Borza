import { LockKeyhole, ShieldAlert } from "lucide-react";

export function PremiumBotCard() {
  return (
    <section
      id="premium"
      aria-labelledby="premium-bot-title"
      className="mt-8 grid scroll-mt-6 border border-[var(--line)] bg-[var(--panel)] lg:grid-cols-[1fr_300px]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
          <LockKeyhole aria-hidden="true" size={14} />
          Separate premium product
        </div>
        <h2
          id="premium-bot-title"
          className="mt-3 text-2xl font-semibold tracking-tight"
        >
          AI Trading Strategy Bot
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          A standalone research tool with backtesting, paper trading, risk
          controls, and an optional confidence filter. It is not part of Borza’s
          runtime and cannot execute trades through this dashboard.
        </p>
      </div>
      <div className="border-t border-[var(--line)] bg-[var(--panel-soft)] p-5 lg:border-l lg:border-t-0">
        <div className="flex items-start gap-3">
          <ShieldAlert
            aria-hidden="true"
            size={17}
            className="mt-0.5 shrink-0 text-[var(--warning)]"
          />
          <div>
            <p className="text-xs font-semibold">
              Private delivery is not configured
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              Checkout remains disabled until server-side payment and private
              object storage are available.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled
          className="mt-5 w-full cursor-not-allowed rounded-sm border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold text-[var(--muted)]"
        >
          Checkout unavailable
        </button>
      </div>
    </section>
  );
}
