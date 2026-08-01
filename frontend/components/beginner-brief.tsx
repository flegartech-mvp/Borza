import { CircleAlert, Eye, Lightbulb } from "lucide-react";
import type { Article } from "@/lib/types";

type BeginnerBriefProps = {
  article: Article | null;
  loading: boolean;
};

function importanceLabel(article: Article): string {
  if (article.urgency === "breaking" || article.urgency === "high") {
    return "High attention";
  }
  if (article.urgency === "medium") {
    return "Worth following";
  }
  return "Background context";
}

export function BeginnerBrief({ article, loading }: BeginnerBriefProps) {
  const watchItem = article?.tickers.length
    ? `Look for further updates involving ${article.tickers.join(", ")}.`
    : "Look for follow-up reporting, company filings, or official statements.";

  return (
    <section
      id="brief"
      aria-labelledby="beginner-brief-title"
      className="panel rounded-2xl p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
        Beginner brief
      </p>
      <h2
        id="beginner-brief-title"
        className="mt-2 text-xl font-semibold tracking-tight"
      >
        The plain-English version
      </h2>

      {loading ? (
        <div className="mt-6 space-y-4" aria-live="polite">
          {["one", "two", "three"].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-xl bg-[var(--panel-soft)]"
            />
          ))}
        </div>
      ) : article ? (
        <div className="mt-6 space-y-4">
          <article className="rounded-xl bg-[var(--panel-soft)] p-4">
            <div className="flex gap-3">
              <Lightbulb
                aria-hidden="true"
                size={18}
                className="mt-0.5 shrink-0 text-amber-400"
              />
              <div>
                <h3 className="text-sm font-semibold">What happened?</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {article.description || article.title}
                </p>
              </div>
            </div>
          </article>
          <article className="rounded-xl bg-[var(--panel-soft)] p-4">
            <div className="flex gap-3">
              <Eye
                aria-hidden="true"
                size={18}
                className="mt-0.5 shrink-0 text-emerald-400"
              />
              <div>
                <h3 className="text-sm font-semibold">
                  What should a beginner watch?
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {watchItem}
                </p>
              </div>
            </div>
          </article>
          <div className="flex items-center gap-2 border-t border-[var(--line)] pt-4 text-sm">
            <CircleAlert
              aria-hidden="true"
              size={17}
              className="text-rose-400"
            />
            <span className="font-semibold">Importance:</span>
            <span className="text-[var(--muted)]">
              {importanceLabel(article)}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--line)] p-4 text-sm leading-6 text-[var(--muted)]">
          We&apos;ll explain the first market story here when the feed is
          available.
        </p>
      )}
    </section>
  );
}
