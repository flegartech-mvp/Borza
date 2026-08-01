import { dominantSentiment, type GeographySelection } from "@/lib/geography";
import type { Article, Sentiment } from "@/lib/types";

export type SectorSummary = {
  sector: string;
  storyCount: number;
  averageImpact: number;
  sentiment: Sentiment;
  topTickers: readonly string[];
  representativeHeadline: string;
};

type SectorBriefingProps = {
  articles: Article[] | null;
  scopeLabel: string;
  scopeType: GeographySelection["kind"];
  totalGlobalArticles: number;
  totalMatchingArticles?: number;
  analysisTruncated?: boolean;
  windowHours?: number;
};

function selectRepresentativeHeadline(articles: readonly Article[]): string {
  return (
    [...articles].sort(
      (first, second) =>
        second.impact_score - first.impact_score ||
        new Date(second.published_at).getTime() -
          new Date(first.published_at).getTime(),
    )[0]?.title ?? ""
  );
}

function topRelatedTickers(articles: readonly Article[]): string[] {
  const counts = new Map<string, number>();
  for (const ticker of articles.flatMap((article) => article.tickers)) {
    counts.set(ticker, (counts.get(ticker) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      (first, second) =>
        second[1] - first[1] || first[0].localeCompare(second[0]),
    )
    .slice(0, 4)
    .map(([ticker]) => ticker);
}

export function buildSectorSummaries(
  articles: readonly Article[],
): SectorSummary[] {
  const bySector = new Map<string, Article[]>();
  for (const article of articles) {
    const sector = article.sector?.trim();
    if (!sector) continue;
    const current = bySector.get(sector);
    if (current) current.push(article);
    else bySector.set(sector, [article]);
  }

  return [...bySector.entries()]
    .map(([sector, sectorArticles]) => ({
      sector,
      storyCount: sectorArticles.length,
      averageImpact:
        sectorArticles.reduce(
          (total, article) => total + article.impact_score,
          0,
        ) / sectorArticles.length,
      sentiment: dominantSentiment(sectorArticles),
      topTickers: topRelatedTickers(sectorArticles),
      representativeHeadline: selectRepresentativeHeadline(sectorArticles),
    }))
    .sort(
      (first, second) =>
        second.storyCount - first.storyCount ||
        second.averageImpact - first.averageImpact ||
        first.sector.localeCompare(second.sector),
    );
}

function scopeIndicator(
  scopeType: GeographySelection["kind"],
  scopeLabel: string,
  storyCount: number,
  totalGlobalArticles: number,
): string {
  const storyLabel = storyCount === 1 ? "story" : "stories";
  if (scopeType === "global")
    return `Based on ${storyCount} visible ${storyLabel} globally.`;
  if (scopeType === "region") {
    return `Based on ${storyCount} of ${totalGlobalArticles} visible ${storyLabel} in ${scopeLabel}, including region-only stories.`;
  }
  return `Based on ${storyCount} of ${totalGlobalArticles} visible ${storyLabel} mapped to ${scopeLabel}.`;
}

export function SectorBriefing({
  articles,
  scopeLabel,
  scopeType,
  totalGlobalArticles,
  totalMatchingArticles = totalGlobalArticles,
  analysisTruncated = false,
  windowHours = 24,
}: SectorBriefingProps) {
  const scopedArticles = articles ?? [];
  const summaries = buildSectorSummaries(scopedArticles);

  return (
    <section
      id="sectors"
      aria-labelledby="sector-briefing-title"
      className="mt-8 scroll-mt-6"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-medium text-[var(--accent)]">
          Active geography: {scopeLabel}
        </p>
        <h2
          id="sector-briefing-title"
          className="mt-1 text-2xl font-semibold tracking-tight"
        >
          Sector analysis — {scopeLabel}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {scopeIndicator(
            scopeType,
            scopeLabel,
            scopedArticles.length,
            totalGlobalArticles,
          )}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          Rolling {windowHours}-hour publication window. The analysis dataset
          contains {totalGlobalArticles} of {totalMatchingArticles} matching
          stories
          {analysisTruncated ? ", using the newest bounded sample" : ""}.
        </p>
      </div>

      {articles === null ? (
        <div
          className="mt-5 h-52 animate-pulse border border-[var(--line)] bg-[var(--panel-soft)]"
          aria-label="Loading sector analysis"
        />
      ) : !scopedArticles.length ? (
        <div className="mt-5 border border-[var(--line)] bg-[var(--panel)] p-8 text-center">
          <h3 className="text-sm font-semibold">No stories in {scopeLabel}</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Select another geography or reset to Global to review available
            sector-tagged coverage.
          </p>
        </div>
      ) : !summaries.length ? (
        <div className="mt-5 border border-[var(--line)] bg-[var(--panel)] p-8 text-center">
          <h3 className="text-sm font-semibold">No sector tags available</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            {scopeIndicator(
              scopeType,
              scopeLabel,
              scopedArticles.length,
              totalGlobalArticles,
            )}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid border border-[var(--line)] bg-[var(--panel)] md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary, index) => (
            <article
              key={summary.sector}
              data-testid="sector-summary"
              className={`${index > 0 ? "border-t md:border-t-0" : ""} ${
                index % 2 === 1 ? "md:border-l" : ""
              } ${index >= 2 ? "md:border-t xl:border-t-0" : ""} ${
                index > 0 ? "xl:border-l" : ""
              } border-[var(--line)] p-5`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="break-words text-base font-semibold">
                  {summary.sector}
                </h3>
                <span className="shrink-0 font-mono text-xs text-[var(--muted)]">
                  {summary.storyCount}{" "}
                  {summary.storyCount === 1 ? "story" : "stories"}
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] text-[var(--muted)]">
                    Article tone
                  </dt>
                  <dd className="mt-1 text-sm font-medium capitalize">
                    {summary.sentiment}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--muted)]">
                    Avg. attention
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-medium">
                    {Math.round(summary.averageImpact)}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <p className="text-[11px] text-[var(--muted)]">
                  Representative headline
                </p>
                <p className="mt-2 break-words text-sm leading-5">
                  {summary.representativeHeadline}
                </p>
              </div>
              <div className="mt-4">
                <p className="text-[11px] text-[var(--muted)]">
                  Top related tickers
                </p>
                <p className="mt-2 break-words font-mono text-xs">
                  {summary.topTickers.length
                    ? summary.topTickers.join(" / ")
                    : "No ticker supplied"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
