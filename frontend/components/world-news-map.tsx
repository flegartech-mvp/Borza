"use client";

import { useMemo, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { feature as topojsonFeature } from "topojson-client";
import worldMap from "world-atlas/countries-110m.json";
import {
  getCountryProfileByAtlasName,
  getRegionForAtlasCountry,
  GLOBAL_SELECTION,
  makeCountrySelection,
  makeRegionSelection,
  REGION_OPTIONS,
  type GeographySelection,
} from "@/lib/geography";
import { aggregateArticlesByGeography } from "@/lib/geography-aggregation";
import type { Article, Sentiment } from "@/lib/types";

type WorldNewsMapProps = {
  articles: Article[];
  selection: GeographySelection;
  onSelectionChange: (selection: GeographySelection) => void;
  analysisLabel?: string;
};

type HoveredCountry = {
  name: string;
  count: number;
  sentiment: Sentiment | null;
  averageImpact: number | null;
  inferredCount: number;
};

const sentimentLabel: Record<Sentiment, string> = {
  positive: "Mostly positive article tone",
  negative: "Mostly negative article tone",
  neutral: "Mostly neutral article tone",
};

type CountryProperties = { name?: string };

const MAP_WIDTH = 800;
const MAP_HEIGHT = 430;
const countryFeatures = topojsonFeature(
  worldMap as never,
  "countries",
) as unknown as FeatureCollection<Geometry, CountryProperties>;
const countryPath = geoPath(
  geoEqualEarth().fitSize([MAP_WIDTH, MAP_HEIGHT], countryFeatures),
);
const mapCountries = countryFeatures.features.map((country, index) => ({
  id: String(country.id ?? index),
  name: country.properties?.name ?? "Unknown country",
  path: countryPath(country) ?? "",
}));
const selectableMapCountries = mapCountries
  .filter(
    (country) =>
      getCountryProfileByAtlasName(country.name)?.[1].atlasName ===
      country.name,
  )
  .sort((left, right) => left.name.localeCompare(right.name));

export function WorldNewsMap({
  articles,
  selection,
  onSelectionChange,
  analysisLabel = `${articles.length} stories`,
}: WorldNewsMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<HoveredCountry | null>(
    null,
  );
  const aggregation = useMemo(
    () => aggregateArticlesByGeography(articles),
    [articles],
  );
  const maximumCount = Math.max(
    1,
    ...aggregation.countryArticleCounts.values(),
  );

  const countryInsight = (countryName: string): HoveredCountry => {
    const countryCode = getCountryProfileByAtlasName(countryName)?.[0] ?? null;
    return {
      name: countryName,
      count: countryCode
        ? (aggregation.countryArticleCounts.get(countryCode) ?? 0)
        : 0,
      sentiment: countryCode
        ? (aggregation.dominantSentimentByCountry.get(countryCode) ?? null)
        : null,
      averageImpact: countryCode
        ? (aggregation.averageImpactByCountry.get(countryCode) ?? null)
        : null,
      inferredCount: countryCode
        ? (aggregation.inferredCountryArticleCounts.get(countryCode) ?? 0)
        : 0,
    };
  };
  const selectedCountry =
    selection.kind === "country" ? countryInsight(selection.countryName) : null;
  const displayedCountry = hoveredCountry ?? selectedCountry;
  const selectedCountrySummary = selectedCountry
    ? [
        `${selectedCountry.name} selected.`,
        `${selectedCountry.count} ${selectedCountry.count === 1 ? "story" : "stories"}.`,
        selectedCountry.sentiment
          ? `${sentimentLabel[selectedCountry.sentiment]}.`
          : "No dominant article tone is available.",
        selectedCountry.averageImpact !== null
          ? `Average attention score ${Math.round(selectedCountry.averageImpact)}.`
          : "No average attention score is available.",
        selectedCountry.inferredCount
          ? `${selectedCountry.inferredCount} of ${selectedCountry.count} mappings inferred.`
          : "No selected-story mappings are inferred.",
      ].join(" ")
    : `${selection.label} scope selected. Use the Country selector to focus one country.`;

  return (
    <section
      aria-labelledby="world-news-map-title"
      className="min-w-0 border-y border-[var(--line)] bg-[var(--panel)] xl:border-y-0 xl:border-x"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3
              id="world-news-map-title"
              className="text-base font-semibold tracking-tight"
            >
              World news map
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Country shading uses mapped subject-story counts. Select a market
              to focus every panel.
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
              Analysis scope: {analysisLabel}.
            </p>
          </div>
          {selection.kind !== "global" ? (
            <button
              type="button"
              onClick={() => onSelectionChange(GLOBAL_SELECTION)}
              className="shrink-0 self-start rounded-sm border border-[var(--line)] px-2 py-1.5 text-[11px] font-medium text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Reset to Global
            </button>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
          {[
            ["Mapped countries", aggregation.countryArticleCounts.size],
            ["Mapped stories", aggregation.mappedCountryArticles],
            ["Region-only", aggregation.regionOnlyArticles],
            ["Unmapped", aggregation.unmappedArticles],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="bg-[var(--panel)] px-2.5 py-2"
            >
              <dt className="text-[10px] text-[var(--muted)]">{label}</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div
          className="flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
          aria-label="Map region filters"
        >
          {REGION_OPTIONS.map((option) => {
            const active =
              selection.kind !== "country" &&
              (selection.kind === "global"
                ? option.id === "global"
                : selection.id === option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  onSelectionChange(makeRegionSelection(option.id))
                }
                aria-label={option.label}
                className={`shrink-0 rounded-sm border px-2 py-1.5 text-[11px] font-medium transition-colors active:translate-y-px ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "border-[var(--line)] bg-transparent text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                aria-pressed={active}
              >
                {option.shortLabel ?? option.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:max-w-xs">
          <label
            htmlFor="world-map-country-selector"
            className="text-xs font-medium text-[var(--muted)]"
          >
            Country
          </label>
          <select
            id="world-map-country-selector"
            aria-label="Select a country"
            aria-describedby="world-map-country-summary"
            value={selection.kind === "country" ? selection.id : ""}
            onChange={(event) => {
              const selectedCountry = selectableMapCountries.find(
                (country) => country.id === event.target.value,
              );
              onSelectionChange(
                selectedCountry
                  ? makeCountrySelection(
                      selectedCountry.id,
                      selectedCountry.name,
                    )
                  : GLOBAL_SELECTION,
              );
            }}
            className="min-w-0 flex-1 rounded-sm border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-xs text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <option value="">All countries / Global</option>
            {selectableMapCountries.map((country) => (
              <option key={country.id} value={country.id}>
                {getCountryProfileByAtlasName(country.name)?.[1].name ??
                  country.name}
              </option>
            ))}
          </select>
        </div>
        <p
          id="world-map-country-summary"
          className="text-[11px] leading-5 text-[var(--muted)]"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {selectedCountrySummary}
        </p>
      </div>

      <figure className="relative min-h-[350px] overflow-hidden bg-[var(--map-water)] sm:min-h-[430px]">
        <div
          className="pointer-events-none absolute left-4 top-4 z-[1] min-w-44 border border-[var(--line)] bg-[var(--panel)]/95 px-3 py-2 shadow-sm"
          aria-hidden="true"
        >
          <p className="text-xs font-semibold">
            {displayedCountry?.name ?? selection.label}
          </p>
          {displayedCountry ? (
            <div className="mt-1 space-y-0.5 text-[11px] text-[var(--muted)]">
              <p>
                {displayedCountry.count}{" "}
                {displayedCountry.count === 1 ? "story" : "stories"}
                {displayedCountry.sentiment
                  ? `, ${sentimentLabel[displayedCountry.sentiment].toLowerCase()}`
                  : ""}
              </p>
              {displayedCountry.averageImpact !== null ? (
                <p>
                  Average attention score{" "}
                  {Math.round(displayedCountry.averageImpact)}
                </p>
              ) : null}
              {displayedCountry.inferredCount ? (
                <p>
                  {displayedCountry.inferredCount} of {displayedCountry.count}{" "}
                  mappings inferred
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              {selection.kind === "country"
                ? "Selected market"
                : "Hover a country"}
            </p>
          )}
        </div>

        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          width="100%"
          height="100%"
          className="h-auto min-h-[350px] w-full sm:min-h-[430px]"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            {mapCountries.map((country) => {
              const countryName = country.name;
              const numericId = country.id;
              const countryCode =
                getCountryProfileByAtlasName(countryName)?.[0] ?? null;
              const count = countryCode
                ? (aggregation.countryArticleCounts.get(countryCode) ?? 0)
                : 0;
              const selectedCountry =
                selection.kind === "country" &&
                selection.countryName === countryName;
              const selectedRegion =
                selection.kind === "region" &&
                getRegionForAtlasCountry(countryName) === selection.region;
              const isHovered = hoveredCountry?.name === countryName;
              // Shading is linear to each country's mapped subject-story count.
              const intensity = count / maximumCount;
              const fill = selectedCountry
                ? "var(--accent)"
                : isHovered
                  ? "var(--map-hover)"
                  : selectedRegion
                    ? "var(--map-region)"
                    : count
                      ? `color-mix(in srgb, var(--accent) ${Math.round(38 + intensity * 42)}%, var(--map-land))`
                      : "var(--map-land)";

              const showCountry = () =>
                setHoveredCountry(countryInsight(countryName));

              // Re-selecting a country intentionally keeps it selected; Global is the reset control.
              const selectCountry = () =>
                onSelectionChange(makeCountrySelection(numericId, countryName));

              return (
                <path
                  key={country.id}
                  d={country.path}
                  data-country-name={countryName}
                  data-country-selectable={countryCode ? "true" : "false"}
                  onMouseEnter={showCountry}
                  onMouseLeave={() => setHoveredCountry(null)}
                  onPointerUp={countryCode ? selectCountry : undefined}
                  fill={fill}
                  stroke={
                    selectedCountry ? "var(--foreground)" : "var(--map-border)"
                  }
                  strokeWidth={selectedCountry ? 1.5 : 0.65}
                  style={{
                    cursor: countryCode ? "pointer" : "default",
                  }}
                />
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-2 bg-[var(--panel)]/90 px-2 py-1 text-[10px] text-[var(--muted)]">
          <span>No coverage</span>
          <span className="h-2 w-8 bg-[var(--map-land)]" aria-hidden="true" />
          <span className="h-2 w-8 bg-[var(--accent)]" aria-hidden="true" />
          <span>More mapped stories</span>
        </div>
        <figcaption className="sr-only">
          Visual world map of mapped story coverage. Use the Country selector
          above for keyboard and assistive-technology access.
        </figcaption>
      </figure>
    </section>
  );
}
