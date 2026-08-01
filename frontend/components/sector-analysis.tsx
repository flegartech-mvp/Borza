import { Building2, ChevronRight } from "lucide-react";
import type { Article, Sentiment } from "@/lib/types";
import { SentimentBadge } from "./sentiment-badge";

type SectorAnalysisProps = {
  articles: Article[] | null;
};

type SectorSummary = {
  name: string;
  articles: Article[];
  averageImpact: number;
  sentiment: Sentiment;
};

function dominantSentiment(articles: Article[]): Sentiment {
  const totals: Record<Sentiment, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  for (const article of articles) {
    totals[article.sentiment] += 1;
  }
  return (Object.entries(totals) as Array<[Sentiment, number]>).sort(
    (first, second) => second[1] - first[1],
  )[0][0];
}

function summarizeSectors(articles: Article[]): SectorSummary[] {
  const grouped = new Map<string, Article[]>();
  for (const article of articles) {
    if (!article.sector) {
      continue;
    }
    grouped.set(article.sector, [
      ...(grouped.get(article.sector) ?? []),
      article,
    ]);
  }
  return [...grouped.entries()]
    .map(([name, sectorArticles]) => ({
      name,
      articles: sectorArticles,
      averageImpact: Math.round(
        sectorArticles.reduce(
          (total, article) => total + article.impact_score,
          0,
        ) / sectorArticles.length,
      ),
      sentiment: dominantSentiment(sectorArticles),
    }))
    .sort(
      (first, second) =>
        second.averageImpact - first.averageImpact ||
        second.articles.length - first.articles.length,
    )
    .slice(0, 4);
}

export function SectorAnalysis({ articles }: SectorAnalysisProps) {
  const sectors = articles ? summarizeSectors(articles) : [];

  return (
    <section
      id="sectors"
      aria-labelledby="sector-analysis-title"
      className="mt-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
            Sector analysis
          </p>
          <h2
            id="sector-analysis-title"
            className="mt-1 text-2xl font-semibold tracking-tight"
          >
            Where the news is concentrated
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Derived from the currently visible news feed.
        </p>
      </div>
      {articles === null ? (
        <div
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          aria-live="polite"
        >
          {["one", "two", "three", "four"].map((item) => (
            <div
              key={item}
              className="panel h-48 animate-pulse rounded-2xl bg-[var(--panel-soft)]"
            />
          ))}
        </div>
      ) : sectors.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sectors.map((sector) => (
            <article
              key={sector.name}
              className="panel flex min-h-48 flex-col rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-sky-500/10 text-sky-400">
                  <Building2 aria-hidden="true" size={18} />
                </span>
                <SentimentBadge sentiment={sector.sentiment} />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{sector.name}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {sector.articles.length}{" "}
                {sector.articles.length === 1 ? "story" : "stories"} · average
                attention {sector.averageImpact}/100
              </p>
              <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                {sector.articles[0].title}
              </p>
              <a
                href="#news"
                className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-emerald-400 hover:underline"
              >
                Read stories <ChevronRight aria-hidden="true" size={15} />
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel mt-4 rounded-2xl p-6 text-sm leading-6 text-[var(--muted)]">
          Sector coverage will appear when a provider supplies sector-tagged
          news.
        </div>
      )}
    </section>
  );
}
