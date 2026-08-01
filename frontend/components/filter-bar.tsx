"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { Filters } from "@/lib/filters";

export type { Filters } from "@/lib/filters";

const field =
  "w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]";

type FilterBarProps = {
  filters: Filters;
  onChange: (value: Filters) => void;
  onReset: () => void;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted)]">
      {children}
    </span>
  );
}

export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const update = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <section
      aria-label="News filters"
      className="mt-4 border border-[var(--line)] bg-[var(--panel-soft)] p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(128px,0.8fr))_auto] xl:items-end">
        <label>
          <Label>Search</Label>
          <span className="relative block">
            <Search
              aria-hidden="true"
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Companies, institutions, or topics"
              maxLength={200}
              className={`${field} pl-9`}
            />
          </span>
        </label>

        <label>
          <Label>Region</Label>
          <select
            value={filters.region}
            onChange={(event) => update("region", event.target.value)}
            className={field}
          >
            <option value="">All regions</option>
            <option value="europe">Europe</option>
            <option value="north_america">North America</option>
            <option value="asia">Asia</option>
            <option value="global">Global</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <Label>Category</Label>
          <select
            value={filters.category}
            onChange={(event) => update("category", event.target.value)}
            className={field}
          >
            <option value="">All categories</option>
            <option value="slovenian_economy">Slovenian economy</option>
            <option value="european_markets">European markets</option>
            <option value="central_banks">Central banks</option>
            <option value="inflation">Inflation</option>
            <option value="interest_rates">Interest rates</option>
            <option value="stocks">Equities</option>
            <option value="bonds">Bonds</option>
            <option value="forex">Currencies</option>
            <option value="commodities">Commodities</option>
            <option value="banking">Banking</option>
            <option value="regulation">Regulation</option>
          </select>
        </label>

        <label>
          <Label>Published</Label>
          <select
            value={filters.window_hours}
            onChange={(event) => update("window_hours", event.target.value)}
            className={field}
          >
            <option value="24">Past 24 hours</option>
            <option value="48">Past 48 hours</option>
            <option value="168">Past 7 days</option>
          </select>
        </label>

        <label>
          <Label>Order</Label>
          <select
            value={filters.sort}
            onChange={(event) => update("sort", event.target.value)}
            className={field}
          >
            <option value="newest">Newest</option>
            <option value="relevance">Relevance</option>
            <option value="most_covered">Most covered</option>
          </select>
        </label>

        <button
          type="button"
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--foreground)]"
          title="Reset all news filters"
        >
          <RotateCcw aria-hidden="true" size={14} />
          Reset
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <label className="inline-flex min-h-10 items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={filters.official_only === "true"}
            onChange={(event) =>
              update("official_only", event.target.checked ? "true" : "")
            }
            className="size-4 accent-[var(--accent)]"
          />
          Official sources only
        </label>

        <details className="group w-full sm:w-auto">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] px-3 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
            <SlidersHorizontal aria-hidden="true" size={14} />
            More filters
          </summary>
          <div className="mt-3 grid gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <label>
              <Label>Source name</Label>
              <input
                value={filters.source}
                onChange={(event) => update("source", event.target.value)}
                placeholder="ECB or publisher"
                maxLength={120}
                className={field}
              />
            </label>
            <label>
              <Label>Source type</Label>
              <select
                value={filters.source_type}
                onChange={(event) => update("source_type", event.target.value)}
                className={field}
              >
                <option value="">All source types</option>
                <option value="official">Official</option>
                <option value="regulator">Regulator</option>
                <option value="exchange">Exchange</option>
                <option value="editorial">Editorial</option>
                <option value="discovery">Discovery</option>
              </select>
            </label>
            <label>
              <Label>Language</Label>
              <select
                value={filters.language}
                onChange={(event) => update("language", event.target.value)}
                className={field}
              >
                <option value="">All languages</option>
                <option value="sl">Slovenian</option>
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="fr">French</option>
                <option value="it">Italian</option>
              </select>
            </label>
            <label>
              <Label>Ticker</Label>
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
              <Label>Article tone</Label>
              <select
                value={filters.sentiment}
                onChange={(event) => update("sentiment", event.target.value)}
                className={field}
              >
                <option value="">All tones</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
              </select>
            </label>
            <label>
              <Label>Minimum relevance</Label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={filters.minimum_relevance}
                onChange={(event) =>
                  update("minimum_relevance", event.target.value)
                }
                placeholder="0-100"
                className={field}
              />
            </label>
            <label>
              <Label>Minimum base attention</Label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={filters.minimum_impact}
                onChange={(event) =>
                  update("minimum_impact", event.target.value)
                }
                placeholder="0-100"
                className={field}
              />
            </label>
          </div>
        </details>
      </div>
    </section>
  );
}
