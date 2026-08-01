"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Inbox, ShieldCheck } from "lucide-react";
import { getArticleGeography, REGION_OPTIONS } from "@/lib/geography";
import { relativeTime } from "@/lib/formatters";
import { safeExternalUrl } from "@/lib/safe-url";
import type { Article } from "@/lib/types";

function geographyLabel(article: Article): {
  label: string;
  inferred: boolean;
} {
  const geography = getArticleGeography(article);
  return {
    label:
      geography.subjectCountryName ??
      REGION_OPTIONS.find((option) => option.id === geography.region)?.label ??
      "Global",
    inferred: geography.isInferred,
  };
}

function articleMeta(article: Article): string {
  return (
    article.sector ??
    (article.tickers.slice(0, 4).join(" / ") || "Kein Sektor oder Ticker")
  );
}

function scopeLabel(selectionLabel: string): string {
  return selectionLabel === "Global" ? "Gesamtmarkt" : selectionLabel;
}

function toneLabel(sentiment: string): string {
  return (
    { positive: "positiv", negative: "negativ", neutral: "neutral" }[
      sentiment
    ] ?? sentiment
  );
}

function SourceLink({ article }: { article: Article }) {
  const sourceUrl = safeExternalUrl(article.article_url);
  if (!sourceUrl)
    return <span className="text-[11px] text-[var(--muted)]">Demo</span>;
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Originalquelle für ${article.title} öffnen`}
      className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
    >
      Quelle <ArrowUpRight aria-hidden="true" size={13} />
    </a>
  );
}

function SourceType({ article }: { article: Article }) {
  const official = ["official", "regulator", "exchange"].includes(
    article.source_type ?? "",
  );
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${
        official
          ? "bg-[var(--positive-soft)] text-[var(--positive)]"
          : "bg-[var(--status-soft)] text-[var(--information)]"
      }`}
    >
      {official ? <ShieldCheck aria-hidden="true" size={11} /> : null}
      {article.source_type === "discovery"
        ? "Entdeckt"
        : article.source_type === "official"
          ? "Offiziell"
          : article.source_type === "regulator"
            ? "Aufsicht"
            : article.source_type === "exchange"
              ? "Börse"
              : article.source_type || "Redaktionell"}
    </span>
  );
}

function useDesktopNewsLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 768px)");
    if (!media) return;
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

type NewsMiniTableProps = {
  articles: Article[];
  selectionLabel?: string;
  resetKey?: string;
  loading?: boolean;
  isDemo?: boolean;
  total?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

export function NewsMiniTable({
  resetKey = "global",
  ...props
}: NewsMiniTableProps) {
  return <NewsMiniTableResults key={resetKey} {...props} />;
}

type NewsMiniTableResultsProps = Omit<NewsMiniTableProps, "resetKey">;

function NewsMiniTableResults({
  articles,
  selectionLabel = "Global",
  loading = false,
  isDemo = false,
  total = articles.length,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: NewsMiniTableResultsProps) {
  const isDesktop = useDesktopNewsLayout();

  if (loading) {
    return (
      <div
        className="grid min-h-48 animate-pulse place-items-center border border-[var(--line)] bg-[var(--panel-soft)] p-8 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-[var(--muted)]">
          Gefilterte Meldungen werden geladen…
        </p>
      </div>
    );
  }

  if (!articles.length) {
    return (
      <div className="grid min-h-48 place-items-center border border-[var(--line)] bg-[var(--panel)] p-8 text-center">
        <div>
          <Inbox
            aria-hidden="true"
            className="mx-auto text-[var(--muted)]"
            size={24}
          />
          <h3 className="mt-3 text-sm font-semibold">
            Keine Meldungen für {scopeLabel(selectionLabel)}
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {hasMore
              ? "Auf der geladenen Seite gibt es keinen Treffer. Lade eine weitere Seite oder wähle eine andere Region."
              : "Setze die Filter zurück oder wähle eine andere Region."}
          </p>
          {hasMore && onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="mt-4 rounded-sm bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-contrast)]"
            >
              {loadingMore ? "Weitere werden geladen…" : "Weitere Seite laden"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const shownCount = articles.length;
  const visibleArticles = articles;

  return (
    <section
      aria-label={`Nachrichtenergebnisse für ${scopeLabel(selectionLabel)}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">
            {scopeLabel(selectionLabel)}
          </span>
          <span aria-hidden="true"> · </span>
          {selectionLabel === "Global"
            ? `${shownCount} von ${total} passenden Meldungen`
            : `${shownCount} regionale Treffer auf geladenen Seiten (${total} serverseitig gefilterte Meldungen insgesamt)`}
          {" · "}rollierendes 24-Stunden-Fenster
        </p>
        {isDemo ? (
          <span className="rounded-sm border border-[var(--warning-line)] bg-[var(--warning-soft)] px-2 py-1 text-[10px] font-medium text-[var(--warning)]">
            Demodaten
          </span>
        ) : null}
      </div>

      {isDesktop ? (
        <div
          className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]"
          data-testid="desktop-news-table"
        >
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
            <caption className="sr-only">
              Serverseitig paginierte Finanznachrichten für{" "}
              {scopeLabel(selectionLabel)}
              mit Veröffentlichungszeit, Überschrift, Region, Quellentyp,
              Relevanz und Originallink.
            </caption>
            <colgroup>
              <col className="w-24" />
              <col />
              <col className="w-36" />
              <col className="w-24" />
              <col className="w-18" />
              <col className="w-20" />
            </colgroup>
            <thead>
              <tr className="bg-[var(--panel-soft)] text-[11px] text-[var(--muted)]">
                <th scope="col" className="px-4 py-3 font-medium">
                  Veröffentlicht
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Meldung
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Markt
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Artikelton
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Relevanz
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Quelle
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleArticles.map((article) => {
                const geography = geographyLabel(article);
                return (
                  <tr
                    key={article.id}
                    className="border-t border-[var(--line)] align-top"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-[var(--muted)]">
                      {relativeTime(article.published_at)}
                    </td>
                    <td className="min-w-0 px-4 py-3">
                      <p className="break-words text-sm font-medium leading-5">
                        {article.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--muted)]">
                        {article.description ||
                          "Keine Zusammenfassung des Herausgebers verfügbar."}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <SourceType article={article} />
                        {article.categories?.slice(0, 2).map((category) => (
                          <span
                            key={category}
                            className="rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
                          >
                            {category.replaceAll("_", " ")}
                          </span>
                        ))}
                        {(article.duplicate_source_count ?? 1) > 1 ? (
                          <span className="text-[10px] text-[var(--muted)]">
                            {article.duplicate_source_count} Quellen
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      <span className="break-words">{geography.label}</span>
                      {geography.inferred ? (
                        <span className="ml-1 whitespace-nowrap text-[10px] text-[var(--accent)]">
                          Abgeleitet
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="px-4 py-3 text-xs capitalize"
                      title={`Methode: ${article.tone_method ?? "fallback"}`}
                    >
                      {toneLabel(article.sentiment)}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-mono text-xs"
                      title="Redaktionelle Relevanzheuristik; keine Kursprognose"
                    >
                      {article.relevance_score ?? article.impact_score}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <SourceLink article={article} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="mobile-news-cards">
          {visibleArticles.map((article) => {
            const geography = geographyLabel(article);
            return (
              <li key={article.id}>
                <article className="border border-[var(--line)] bg-[var(--panel)] p-4">
                  <div className="flex items-start justify-between gap-3 text-[11px] text-[var(--muted)]">
                    <span className="min-w-0 truncate" title={article.source}>
                      {article.source}
                    </span>
                    <span className="shrink-0 font-mono">
                      {relativeTime(article.published_at)}
                    </span>
                  </div>
                  <h3 className="mt-2 break-words text-sm font-semibold leading-5">
                    {article.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--muted)]">
                    {article.description ||
                      "Keine Zusammenfassung des Herausgebers verfügbar."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <SourceType article={article} />
                    {article.categories?.slice(0, 2).map((category) => (
                      <span
                        key={category}
                        className="rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
                      >
                        {category.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[10px] text-[var(--muted)]">Markt</dt>
                      <dd className="mt-1 break-words">
                        {geography.label}
                        {geography.inferred ? (
                          <span className="ml-1 rounded-sm bg-[var(--accent-soft)] px-1 py-0.5 text-[10px] text-[var(--accent)]">
                            Abgeleitet
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[var(--muted)]">
                        Artikelton
                      </dt>
                      <dd className="mt-1 capitalize">
                        {toneLabel(article.sentiment)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[var(--muted)]">
                        Relevanz
                      </dt>
                      <dd className="mt-1 font-mono">
                        {article.relevance_score ?? article.impact_score}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] text-[var(--muted)]">
                        Sektor / Ticker
                      </dt>
                      <dd className="mt-1 break-words font-mono text-[11px]">
                        {articleMeta(article)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 text-xs">
                    <SourceLink article={article} />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {hasMore && onLoadMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-sm bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-contrast)] active:translate-y-px"
          >
            {loadingMore
              ? "Weitere werden geladen…"
              : `Nächste ${Math.min(12, total - shownCount)} Meldungen laden`}
          </button>
        ) : (
          <span />
        )}
      </div>
    </section>
  );
}
