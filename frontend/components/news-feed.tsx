import { Inbox } from "lucide-react";
import type { Article } from "@/lib/types";
import { NewsCard } from "./news-card";
export function NewsFeed({ articles }: { articles: Article[] }) {
  if (!articles.length)
    return (
      <section className="panel mt-5 rounded-xl p-10 text-center">
        <Inbox className="mx-auto text-[var(--muted)]" />
        <h2 className="mt-3 font-semibold">No articles match these filters.</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Try widening the search or reset the filters.
        </p>
      </section>
    );
  return (
    <section className="mt-5 space-y-3" aria-live="polite">
      {articles.map((article, index) => (
        <NewsCard key={article.id} article={article} fresh={index === 0} />
      ))}
    </section>
  );
}
