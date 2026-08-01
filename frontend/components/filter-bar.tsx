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
      aria-label="Nachrichtenfilter"
      className="mt-4 border border-[var(--line)] bg-[var(--panel-soft)] p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(128px,0.8fr))_auto] xl:items-end">
        <label>
          <Label>Suche</Label>
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
              placeholder="Unternehmen, Institutionen oder Themen"
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
            <option value="">Alle Regionen</option>
            <option value="europe">Europa</option>
            <option value="north_america">Nordamerika</option>
            <option value="asia">Asien</option>
            <option value="global">Global</option>
            <option value="other">Weitere</option>
          </select>
        </label>

        <label>
          <Label>Kategorie</Label>
          <select
            value={filters.category}
            onChange={(event) => update("category", event.target.value)}
            className={field}
          >
            <option value="">Alle Kategorien</option>
            <option value="german_markets">Deutsche Märkte</option>
            <option value="german_macro">Deutsche Konjunktur</option>
            <option value="german_companies">Deutsche Unternehmen</option>
            <option value="european_markets">Europäische Märkte</option>
            <option value="central_banks">Zentralbanken</option>
            <option value="slovenian_economy">Slowenische Wirtschaft</option>
            <option value="inflation">Inflation</option>
            <option value="interest_rates">Zinsen</option>
            <option value="stocks">Aktien</option>
            <option value="bonds">Anleihen</option>
            <option value="forex">Währungen</option>
            <option value="commodities">Rohstoffe</option>
            <option value="banking">Banken</option>
            <option value="regulation">Regulierung</option>
          </select>
        </label>

        <label>
          <Label>Veröffentlicht</Label>
          <select
            value={filters.window_hours}
            onChange={(event) => update("window_hours", event.target.value)}
            className={field}
          >
            <option value="24">Letzte 24 Stunden</option>
            <option value="48">Letzte 48 Stunden</option>
            <option value="168">Letzte 7 Tage</option>
          </select>
        </label>

        <label>
          <Label>Sortierung</Label>
          <select
            value={filters.sort}
            onChange={(event) => update("sort", event.target.value)}
            className={field}
          >
            <option value="newest">Neueste zuerst</option>
            <option value="relevance">Relevanz</option>
            <option value="most_covered">Meiste Quellen</option>
          </select>
        </label>

        <button
          type="button"
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--foreground)]"
          title="Alle Nachrichtenfilter zurücksetzen"
        >
          <RotateCcw aria-hidden="true" size={14} />
          Zurücksetzen
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
          Nur offizielle Quellen
        </label>

        <details className="group w-full sm:w-auto">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] px-3 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
            <SlidersHorizontal aria-hidden="true" size={14} />
            Weitere Filter
          </summary>
          <div className="mt-3 grid gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <label>
              <Label>Quellenname</Label>
              <input
                value={filters.source}
                onChange={(event) => update("source", event.target.value)}
                placeholder="EZB oder Herausgeber"
                maxLength={120}
                className={field}
              />
            </label>
            <label>
              <Label>Quellentyp</Label>
              <select
                value={filters.source_type}
                onChange={(event) => update("source_type", event.target.value)}
                className={field}
              >
                <option value="">Alle Quellentypen</option>
                <option value="official">Offiziell</option>
                <option value="regulator">Aufsicht</option>
                <option value="exchange">Börse</option>
                <option value="editorial">Redaktionell</option>
                <option value="discovery">Entdeckung</option>
              </select>
            </label>
            <label>
              <Label>Sprache</Label>
              <select
                value={filters.language}
                onChange={(event) => update("language", event.target.value)}
                className={field}
              >
                <option value="">Alle Sprachen</option>
                <option value="de">Deutsch</option>
                <option value="sl">Slowenisch</option>
                <option value="en">Englisch</option>
                <option value="fr">Französisch</option>
                <option value="it">Italienisch</option>
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
              <Label>Artikelton</Label>
              <select
                value={filters.sentiment}
                onChange={(event) => update("sentiment", event.target.value)}
                className={field}
              >
                <option value="">Alle Tonlagen</option>
                <option value="positive">Positiv</option>
                <option value="negative">Negativ</option>
                <option value="neutral">Neutral</option>
              </select>
            </label>
            <label>
              <Label>Mindest-Relevanz</Label>
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
              <Label>Mindest-Aufmerksamkeit</Label>
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
