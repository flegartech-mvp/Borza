"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  Newspaper,
  RefreshCw,
} from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { MarketOverview } from "@/components/market-overview";
import { NewsMiniTable } from "@/components/news-mini-table";
import { NewsFreshnessPanel } from "@/components/news-freshness-panel";
import { RegionNewsPanel } from "@/components/region-news-panel";
import { SectorBriefing } from "@/components/sector-briefing";
import { useNewsStream } from "@/hooks/use-news-stream";
import { isTrueFeedUnavailable } from "@/lib/api";
import { UI_DEMO_ARTICLES, statsFromArticles } from "@/lib/demo-news";
import {
  applyFilterUpdate,
  DEFAULT_FILTERS,
  filtersToUrlSearchParams,
  type FilterIssue,
  type Filters,
} from "@/lib/filters";
import {
  articleMatchesSelection,
  GLOBAL_SELECTION,
  type GeographySelection,
} from "@/lib/geography";

const WorldNewsMap = dynamic(
  () =>
    import("@/components/world-news-map").then((module) => module.WorldNewsMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="grid min-h-[430px] animate-pulse place-items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)]"
        role="status"
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Interaktive Karte wird geladen…
        </p>
      </div>
    ),
  },
);

function useWorkspaceData(
  initialFilters: Filters,
  initialFilterIssues: FilterIssue[],
  syncFiltersToUrl: boolean,
) {
  const [filters, setFilters] = useState(initialFilters);
  const [filterDrafts, setFilterDrafts] = useState(initialFilters);
  const [filterIssues, setFilterIssues] = useState(initialFilterIssues);
  const [selection, setSelection] =
    useState<GeographySelection>(GLOBAL_SELECTION);
  const stream = useNewsStream(filters);

  useEffect(() => {
    if (!syncFiltersToUrl) return;
    const query = filtersToUrlSearchParams(window.location.search, filters);
    const suffix = query.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${suffix ? `?${suffix}` : ""}${window.location.hash}`,
    );
  }, [filters, syncFiltersToUrl]);

  const feed = stream.feedState.data;
  const analysis = stream.analysisState.data;
  const stats = stream.statsState.data;
  const feedUsingDemoFallback =
    feed === null && isTrueFeedUnavailable(stream.feedState.error);
  const liveVisibleArticles = analysis?.articles ?? feed?.items ?? null;
  const usingDemoFallback =
    liveVisibleArticles === null && feedUsingDemoFallback;
  const visibleArticles =
    liveVisibleArticles ?? (usingDemoFallback ? UI_DEMO_ARTICLES : null);
  const visibleStats =
    stats ?? (usingDemoFallback ? statsFromArticles(UI_DEMO_ARTICLES) : null);
  const apiDemo =
    visibleArticles?.some((article) => article.is_demo) === true &&
    !usingDemoFallback;
  const feedApiDemo =
    feed?.items.some((article) => article.is_demo) === true &&
    !feedUsingDemoFallback;
  const selectedArticles = useMemo(
    () =>
      visibleArticles?.filter((article) =>
        articleMatchesSelection(article, selection),
      ) ?? [],
    [selection, visibleArticles],
  );

  const updateFilters = (next: Filters) => {
    const update = applyFilterUpdate(filterDrafts, filterIssues, next);
    setFilters(update.filters);
    setFilterDrafts(update.drafts);
    setFilterIssues(update.issues);
  };

  const resetFilters = () => {
    setFilterIssues([]);
    setFilters(DEFAULT_FILTERS);
    setFilterDrafts(DEFAULT_FILTERS);
  };

  return {
    ...stream,
    filters,
    filterDrafts,
    filterIssues,
    selection,
    setSelection,
    feed,
    analysis,
    stats,
    visibleArticles,
    visibleStats,
    selectedArticles,
    usingDemoFallback,
    feedUsingDemoFallback,
    apiDemo,
    feedApiDemo,
    updateFilters,
    resetFilters,
    dismissFilterIssues: () => setFilterIssues([]),
  };
}

function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-[var(--brand)]">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-[30px]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">
          {description}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

function DataModeNotice({
  fallback,
  apiDemo,
}: {
  fallback: boolean;
  apiDemo: boolean;
}) {
  if (!fallback && !apiDemo) return null;
  return (
    <section
      aria-label="Hinweis zu Demodaten"
      className="mb-4 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--warning)_38%,var(--border-subtle))] bg-[var(--warning-soft)] px-4 py-3 text-sm"
    >
      <AlertTriangle
        aria-hidden="true"
        size={17}
        className="mt-0.5 shrink-0 text-[var(--warning)]"
      />
      <div>
        <p className="font-semibold text-[var(--text-primary)]">
          {fallback ? "Simulierte Ersatzmeldungen" : "Demodaten"}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
          {fallback
            ? "Der API-Feed ist nicht verfügbar. Diese gekennzeichneten Meldungen sind lokale Beispiele, keine Live-Berichte."
            : "Der aktuelle Anbieter liefert simulierte Meldungen. Es handelt sich nicht um Live-Marktberichte."}
        </p>
      </div>
    </section>
  );
}

function InlineEndpointNotice({
  message,
  retained,
}: {
  message: string;
  retained: boolean;
}) {
  return (
    <p
      className="mb-4 rounded-[var(--radius-sm)] border-l-2 border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 text-xs leading-5 text-[var(--text-secondary)]"
      role="status"
    >
      {message}{" "}
      {retained
        ? "Die letzten erfolgreich geladenen Daten bleiben sichtbar."
        : "Dieser Bereich ist vorübergehend nicht verfügbar."}
    </p>
  );
}

export function OverviewWorkspace() {
  const data = useWorkspaceData(DEFAULT_FILTERS, [], false);

  return (
    <>
      <PageIntro
        eyebrow="Deutsche und europäische Märkte"
        title="Was den Markt gerade bewegt"
        description="Ein kompakter Überblick über Quellenabdeckung, Artikelton, redaktionelle Aufmerksamkeit und relevante Meldungen."
        actions={
          <button
            type="button"
            onClick={data.refresh}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <RefreshCw aria-hidden="true" size={15} />
            Aktualisieren
          </button>
        }
      />

      <DataModeNotice
        fallback={data.usingDemoFallback}
        apiDemo={data.apiDemo}
      />

      {data.statsState.error ? (
        <InlineEndpointNotice
          message={data.statsState.error.message}
          retained={data.stats !== null}
        />
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-md)]">
        <MarketOverview
          stats={data.visibleStats}
          loading={
            data.visibleStats === null &&
            (data.statsState.phase === "idle" ||
              data.statsState.phase === "loading")
          }
        />
      </div>

      {data.analysisState.error ? (
        <div className="mt-5">
          <InlineEndpointNotice
            message={data.analysisState.error.message}
            retained={data.analysis !== null}
          />
        </div>
      ) : null}

      <section className="mt-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
          {data.visibleArticles === null ? (
            <div
              className="min-h-[430px] animate-pulse bg-[var(--surface-2)]"
              role="status"
              aria-label="Wichtige Nachrichten werden geladen"
            />
          ) : (
            <RegionNewsPanel
              articles={data.selectedArticles}
              selection={GLOBAL_SELECTION}
            />
          )}
        </div>

        <aside className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
          <p className="text-xs font-semibold text-[var(--brand)]">
            Weiter analysieren
          </p>
          <h3 className="mt-2 text-lg font-semibold">Die passende Ansicht</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Dieselben Quelldaten werden in klar getrennten Arbeitsbereichen
            aufbereitet.
          </p>
          <div className="mt-5 space-y-2">
            {[
              {
                href: "/news",
                label: "Katalysatoren öffnen",
                detail: "Meldungen nach Quelle, Markt und Ticker filtern",
                icon: Newspaper,
              },
              {
                href: "/learn",
                label: "Borza Learn öffnen",
                detail: "Ton, Aufmerksamkeit und Aktualität verstehen",
                icon: BookOpenText,
              },
            ].map(({ href, label, detail, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-h-14 items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 hover:border-[var(--border-strong)]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">
                    {detail}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  size={15}
                  className="text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <SectorBriefing
        articles={data.visibleArticles === null ? null : data.selectedArticles}
        scopeLabel="Global"
        scopeType="global"
        totalGlobalArticles={data.visibleArticles?.length ?? 0}
        totalMatchingArticles={
          data.analysis?.total_matching ?? data.visibleArticles?.length ?? 0
        }
        analysisTruncated={data.analysis?.truncated ?? false}
        windowHours={data.analysis?.effective_window_hours ?? 24}
      />
    </>
  );
}

export function NewsWorkspace({
  initialFilters = DEFAULT_FILTERS,
  initialFilterIssues = [],
}: {
  initialFilters?: Filters;
  initialFilterIssues?: FilterIssue[];
}) {
  const data = useWorkspaceData(initialFilters, initialFilterIssues, true);
  const feedArticles = data.feedUsingDemoFallback
    ? UI_DEMO_ARTICLES
    : (data.feed?.items ?? []);
  const resetKey = JSON.stringify(data.filters);

  return (
    <>
      <PageIntro
        eyebrow="Quellenbasierte Marktereignisse"
        title="Katalysatoren"
        description="Durchsuche und filtere aktuelle Meldungen. Ton und Aufmerksamkeit bleiben Kontextdaten, keine Handelssignale."
        actions={
          <span className="inline-flex min-h-10 items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 font-mono text-xs text-[var(--text-secondary)]">
            {data.feed
              ? `${data.feed.total} passende ${data.feed.total === 1 ? "Meldung" : "Meldungen"}`
              : "Ergebnisse werden geladen"}
          </span>
        }
      />

      <DataModeNotice
        fallback={data.feedUsingDemoFallback}
        apiDemo={data.feedApiDemo}
      />

      <NewsFreshnessPanel
        state={data.freshnessState}
        referenceTime={data.feed?.window_end}
      />

      {data.feed?.partial_results ? (
        <InlineEndpointNotice
          message="Einige konfigurierte Nachrichtenanbieter waren beim letzten Abruf eingeschränkt."
          retained
        />
      ) : null}

      {data.feed?.data_freshness === "stale" ? (
        <InlineEndpointNotice
          message="Der letzte erfolgreiche Abruf liegt außerhalb des Aktualitätsziels."
          retained
        />
      ) : null}

      <FilterBar
        filters={data.filterDrafts}
        onChange={data.updateFilters}
        onReset={data.resetFilters}
      />

      {data.filterIssues.length ? (
        <section
          className="mt-3 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--warning)_38%,var(--border-subtle))] bg-[var(--warning-soft)] px-4 py-3"
          role="alert"
          aria-label="Ungültige Filter"
        >
          <p className="text-sm font-semibold">Diese Filter prüfen</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-[var(--text-secondary)]">
            {data.filterIssues.map((issue) => (
              <li key={`${issue.field}-${issue.code}`}>{issue.message}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={data.dismissFilterIssues}
            className="mt-2 text-xs font-semibold underline underline-offset-2"
          >
            Ausblenden
          </button>
        </section>
      ) : null}

      {data.feedState.error && !data.feedUsingDemoFallback ? (
        <section
          className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              size={18}
              className="mt-0.5 text-[var(--negative)]"
            />
            <div>
              <p className="text-sm font-semibold">
                {data.feedState.error.message}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                {data.feed
                  ? "Der letzte erfolgreiche Feed bleibt sichtbar."
                  : "Filter oder Endpunktkonfiguration prüfen und erneut versuchen."}
              </p>
              <button
                type="button"
                onClick={data.refresh}
                className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-3 text-xs font-semibold text-[var(--brand-contrast)]"
              >
                <RefreshCw aria-hidden="true" size={14} />
                Feed erneut laden
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-[var(--radius-md)]">
        <NewsMiniTable
          articles={feedArticles}
          selectionLabel="Global"
          resetKey={resetKey}
          loading={
            !data.feedUsingDemoFallback &&
            data.feed === null &&
            (data.feedState.phase === "idle" ||
              data.feedState.phase === "loading")
          }
          isDemo={data.feedUsingDemoFallback || data.feedApiDemo}
          total={
            data.feedUsingDemoFallback
              ? UI_DEMO_ARTICLES.length
              : (data.feed?.total ?? 0)
          }
          hasMore={!data.feedUsingDemoFallback && Boolean(data.feed?.has_more)}
          loadingMore={data.loadingMore}
          onLoadMore={data.loadMore}
        />
      </div>

      {data.paginationError ? (
        <p className="mt-2 text-xs text-[var(--negative)]" role="alert">
          {data.paginationError.message} Der vorhandene Feed bleibt sichtbar.
        </p>
      ) : null}
    </>
  );
}

export function MapWorkspace() {
  const data = useWorkspaceData(DEFAULT_FILTERS, [], false);

  return (
    <>
      <PageIntro
        eyebrow="Geographic coverage"
        title="World Map"
        description="Explore where current reporting is concentrated. Country shading reflects mapped subject-story counts, not market performance."
      />

      <DataModeNotice
        fallback={data.usingDemoFallback}
        apiDemo={data.apiDemo}
      />

      {data.analysisState.error ? (
        <InlineEndpointNotice
          message={data.analysisState.error.message}
          retained={data.analysis !== null || data.feed !== null}
        />
      ) : null}

      {data.visibleArticles === null ? (
        <div
          className="min-h-[560px] animate-pulse rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)]"
          role="status"
          aria-label="Loading geographic news workspace"
        />
      ) : (
        <div className="grid min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.65fr)]">
          <div className="min-w-0">
            <WorldNewsMap
              articles={data.visibleArticles}
              selection={data.selection}
              onSelectionChange={data.setSelection}
              analysisLabel={
                data.analysis
                  ? `${data.analysis.sample_size} of ${data.analysis.total_matching} matching stories in the rolling ${data.analysis.effective_window_hours}-hour window${data.analysis.truncated ? " (newest bounded sample)" : ""}`
                  : data.usingDemoFallback
                    ? "Demo sample"
                    : data.feed
                      ? `${data.feed.items.length} stories from the current feed page`
                      : "Analysis unavailable"
              }
            />
          </div>
          <div className="min-w-0 border-t border-[var(--border-subtle)] xl:border-l xl:border-t-0">
            <RegionNewsPanel
              articles={data.selectedArticles}
              selection={data.selection}
            />
          </div>
        </div>
      )}
    </>
  );
}
