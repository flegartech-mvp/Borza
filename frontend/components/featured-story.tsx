import { ArrowUpRight, Sparkles } from "lucide-react";
import { relativeTime } from "@/lib/formatters";
import { safeExternalUrl } from "@/lib/safe-url";
import type { Article } from "@/lib/types";
import { SentimentBadge } from "./sentiment-badge";

type FeaturedStoryProps = {
  article: Article | null;
  loading: boolean;
};

function whyItMatters(article: Article): string {
  if (article.tickers.length > 1) {
    return `The story may shape attention around ${article.tickers.join(", ")} and its related sector.`;
  }
  if (article.tickers.length === 1) {
    return `The story mentions ${article.tickers[0]}, so investors may watch for follow-up news and company context.`;
  }
  if (article.sector) {
    return `It may matter for the ${article.sector} sector as more coverage and company updates arrive.`;
  }
  return "It is currently one of the most relevant stories in Borza's news feed.";
}

export function FeaturedStory({ article, loading }: FeaturedStoryProps) {
  const sourceUrl = article ? safeExternalUrl(article.article_url) : null;

  return (
    <section
      aria-labelledby="featured-story-title"
      className="panel rounded-2xl p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            <Sparkles aria-hidden="true" size={14} /> Featured story
          </p>
          <h2
            id="featured-story-title"
            className="mt-2 text-xl font-semibold tracking-tight"
          >
            The story to understand first
          </h2>
        </div>
        {article ? <SentimentBadge sentiment={article.sentiment} /> : null}
      </div>

      {loading ? (
        <div className="mt-7 space-y-3" aria-live="polite">
          <div className="h-6 w-4/5 animate-pulse rounded bg-[var(--panel-soft)]" />
          <div className="h-4 w-full animate-pulse rounded bg-[var(--panel-soft)]" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-[var(--panel-soft)]" />
        </div>
      ) : article ? (
        <div className="mt-6">
          <h3 className="max-w-3xl text-xl font-semibold leading-8 sm:text-2xl">
            {article.title}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            {article.description || "This source did not provide a summary."}
          </p>
          <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
              Why this matters
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
              {whyItMatters(article)}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
            <span>{article.source}</span>
            <span>{relativeTime(article.published_at)}</span>
            <span
              className="font-mono"
              title="Decaying editorial-attention heuristic; not a price forecast"
            >
              Attention {article.impact_score}/100
            </span>
            {article.tickers.map((ticker) => (
              <span
                key={ticker}
                className="rounded-md bg-sky-500/10 px-2 py-1 font-mono text-sky-400"
              >
                {ticker}
              </span>
            ))}
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-400 hover:underline"
              >
                Read source <ArrowUpRight aria-hidden="true" size={14} />
              </a>
            ) : (
              <span className="ml-auto">Source link unavailable</span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-7 rounded-xl border border-dashed border-[var(--line)] p-5 text-sm leading-6 text-[var(--muted)]">
          A featured story appears once the news provider has stored its first
          article.
        </div>
      )}
    </section>
  );
}
