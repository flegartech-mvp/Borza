import { ArrowUpRight, Globe2 } from "lucide-react";
import { relativeTime } from "@/lib/formatters";
import { safeExternalUrl } from "@/lib/safe-url";
import type { GeographySelection } from "@/lib/geography";
import type { Article } from "@/lib/types";

type RegionNewsPanelProps = {
  articles: Article[];
  selection: GeographySelection;
};

const sentimentTone = {
  positive: "text-[var(--positive)]",
  negative: "text-[var(--negative)]",
  neutral: "text-[var(--neutral)]",
} as const;

export function RegionNewsPanel({ articles, selection }: RegionNewsPanelProps) {
  const ordered = [...articles].sort(
    (first, second) =>
      second.impact_score - first.impact_score ||
      new Date(second.published_at).getTime() -
        new Date(first.published_at).getTime(),
  );
  const lead = ordered[0];

  return (
    <section
      aria-labelledby="region-news-title"
      className="flex min-h-[430px] min-w-0 flex-col bg-[var(--panel)]"
    >
      <div className="border-b border-[var(--line)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--accent)]">
              {selection.label}
            </p>
            <h3
              id="region-news-title"
              className="mt-1 text-base font-semibold tracking-tight"
            >
              Market brief
            </h3>
          </div>
          <p className="font-mono text-xs text-[var(--muted)]">
            {articles.length} {articles.length === 1 ? "story" : "stories"}
          </p>
        </div>
      </div>

      {lead ? (
        <>
          <article className="border-b border-[var(--line)] px-4 py-5">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span
                className={`font-semibold capitalize ${sentimentTone[lead.sentiment]}`}
              >
                Article tone: {lead.sentiment}
              </span>
              <span className="font-mono text-[var(--muted)]">
                Attention {lead.impact_score}
              </span>
            </div>
            <h4 className="mt-3 text-lg font-semibold leading-6 tracking-tight">
              {lead.title}
            </h4>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
              {lead.description || "This source did not provide a summary."}
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <span>{lead.source}</span>
              <span aria-hidden="true">/</span>
              <span>{relativeTime(lead.published_at)}</span>
              {safeExternalUrl(lead.article_url) ? (
                <a
                  href={safeExternalUrl(lead.article_url) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                >
                  Source <ArrowUpRight aria-hidden="true" size={12} />
                </a>
              ) : null}
            </div>
          </article>

          <div className="flex-1">
            {ordered.slice(1, 5).map((article) => (
              <article
                key={article.id}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <h4 className="line-clamp-2 text-sm font-medium leading-5">
                    {article.title}
                  </h4>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {article.source} / {relativeTime(article.published_at)}
                  </p>
                </div>
                <span className="font-mono text-xs text-[var(--muted)]">
                  {article.impact_score}
                </span>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <div>
            <Globe2
              aria-hidden="true"
              className="mx-auto text-[var(--muted)]"
              size={25}
            />
            <h4 className="mt-4 text-sm font-semibold">
              No mapped stories for {selection.label}
            </h4>
            <p className="mx-auto mt-2 max-w-64 text-xs leading-5 text-[var(--muted)]">
              Choose Global or another highlighted market. New provider stories
              will appear here when geography is available.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
