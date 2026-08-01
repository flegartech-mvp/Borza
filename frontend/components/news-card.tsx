import { ArrowUpRight, Clock3 } from "lucide-react";
import { relativeTime, percent } from "@/lib/formatters";
import { safeExternalUrl } from "@/lib/safe-url";
import type { Article } from "@/lib/types";
import { SentimentBadge } from "./sentiment-badge";

const edge = {
  positive: "border-l-emerald-400",
  negative: "border-l-rose-400",
  neutral: "border-l-amber-400",
};

export function NewsCard({
  article,
  fresh,
}: {
  article: Article;
  fresh?: boolean;
}) {
  const sourceUrl = safeExternalUrl(article.article_url);

  return (
    <article
      className={`panel fade-in rounded-xl border-l-[3px] p-4 sm:p-5 ${edge[article.sentiment]}`}
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SentimentBadge sentiment={article.sentiment} />
            <span className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-xs font-medium text-[var(--muted)]">
              {article.urgency}
            </span>
            {fresh ? (
              <span className="text-xs font-medium text-emerald-400">New</span>
            ) : null}
            <span className="ml-auto flex items-center gap-1 text-xs text-[var(--muted)]">
              <Clock3 aria-hidden="true" size={12} />
              {relativeTime(article.published_at)}
            </span>
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 sm:text-lg">
            {article.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
            {article.description ||
              "No description was supplied for this article."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--muted)]">
              {article.source}
            </span>
            <span className="text-xs text-[var(--muted)]">
              Article-tone confidence {percent(article.sentiment_confidence)}
            </span>
            <span className="font-mono text-xs text-[var(--muted)]">
              Attention {article.impact_score}/100
            </span>
            {article.sector ? (
              <span className="text-xs text-[var(--muted)]">
                {article.sector}
              </span>
            ) : null}
            {article.tickers.map((ticker) => (
              <span
                key={ticker}
                className="rounded bg-sky-500/10 px-1.5 py-0.5 font-mono text-xs text-sky-400"
              >
                {ticker}
              </span>
            ))}
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-400 hover:underline"
              >
                Source <ArrowUpRight aria-hidden="true" size={13} />
              </a>
            ) : (
              <span className="ml-auto text-xs text-[var(--muted)]">
                Source unavailable
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
