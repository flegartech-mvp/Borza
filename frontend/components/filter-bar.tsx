"use client";

import { RotateCcw, Search } from "lucide-react";
import type { Filters } from "@/lib/filters";

export type { Filters } from "@/lib/filters";

const field =
  "w-full rounded-sm border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]";

type FilterBarProps = {
  filters: Filters;
  onChange: (value: Filters) => void;
  onReset: () => void;
};

export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const update = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <section
      aria-label="News filters"
      className="mt-4 border border-[var(--line)] bg-[var(--panel-soft)] p-3"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_repeat(4,1fr)_auto] xl:items-end">
        <label>
          <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted)]">
            Search
          </span>
          <span className="relative block">
            <Search
              aria-hidden="true"
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              value={filters.search}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Headlines or companies"
              maxLength={200}
              className={`${field} pl-9`}
            />
          </span>
        </label>
        <label>
          <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted)]">
            Article tone
          </span>
          <select
            value={filters.sentiment}
            onChange={(event) => update("sentiment", event.target.value)}
            className={field}
          >
            <option value="">All article tones</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted)]">
            Ticker
          </span>
          <input
            value={filters.ticker}
            onChange={(event) => update("ticker", event.target.value)}
            placeholder="AAPL"
            maxLength={13}
            autoCapitalize="characters"
            autoComplete="off"
            className={field}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted)]">
            Urgency
          </span>
          <select
            value={filters.urgency}
            onChange={(event) => update("urgency", event.target.value)}
            className={field}
          >
            <option value="">All urgency</option>
            <option value="breaking">Breaking</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted)]">
            Minimum base attention
          </span>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={filters.minimum_impact}
            onChange={(event) => update("minimum_impact", event.target.value)}
            placeholder="0–100"
            className={field}
          />
        </label>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-sm border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--foreground)] active:translate-y-px"
        >
          <RotateCcw aria-hidden="true" size={13} />
          Reset
        </button>
      </div>
    </section>
  );
}
