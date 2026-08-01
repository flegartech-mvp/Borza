import { Activity, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import type { Stats } from "@/lib/types";

type MarketOverviewProps = {
  stats: Stats | null;
  loading: boolean;
};

function percentage(value: number, total: number): string {
  return total ? `${Math.round((value / total) * 100)}%` : "Nicht verfügbar";
}

export function MarketOverview({ stats, loading }: MarketOverviewProps) {
  const total = stats?.article_count ?? 0;
  const boundedImpactNote =
    stats && stats.sample_size < stats.article_count
      ? ` Die durchschnittliche Aufmerksamkeit nutzt die neuesten ${stats.sample_size} passenden Meldungen.`
      : "";
  const items = [
    {
      label: "Meldungen im Zeitraum",
      value: loading ? "Lädt" : total.toString(),
      icon: Activity,
      tone: "text-[var(--foreground)]",
    },
    {
      label: "Positiver Ton",
      value: loading
        ? "Lädt"
        : percentage(stats?.sentiment_distribution.positive ?? 0, total),
      icon: TrendingUp,
      tone: "text-[var(--positive)]",
    },
    {
      label: "Negativer Ton",
      value: loading
        ? "Lädt"
        : percentage(stats?.sentiment_distribution.negative ?? 0, total),
      icon: TrendingDown,
      tone: "text-[var(--negative)]",
    },
    {
      label: "Ø Aufmerksamkeit",
      value: loading
        ? "Lädt"
        : stats
          ? `${stats.average_impact.toFixed(0)} / 100`
          : "Nicht verfügbar",
      icon: Gauge,
      tone: "text-[var(--accent)]",
    },
    {
      label: "Meistgenannt",
      value: loading ? "Lädt" : (stats?.top_ticker ?? "Kein Ticker"),
      icon: Activity,
      tone: "text-[var(--foreground)]",
    },
  ] as const;

  return (
    <section
      id="markets"
      aria-label="Aktuelle Nachrichtenübersicht"
      className="mt-3"
    >
      <div className="grid grid-cols-2 border border-[var(--line)] bg-[var(--panel)] md:grid-cols-5">
        {items.map(({ label, value, icon: Icon, tone }, index) => (
          <article
            key={label}
            className={`${index >= 2 ? "border-t" : ""} ${
              index % 2 === 1 ? "border-l" : ""
            } ${index === 4 ? "col-span-2 md:col-span-1" : ""} ${
              index > 0 ? "md:border-l" : ""
            } border-[var(--line)] px-4 py-3 md:border-t-0`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--muted)]">{label}</p>
              <Icon aria-hidden="true" size={14} className={tone} />
            </div>
            <p className="mt-2 truncate font-mono text-base font-semibold">
              {value}
            </p>
          </article>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
        Rollierender Zeitraum von {stats?.effective_window_hours ?? 24} Stunden
        nach Veröffentlichungszeit
        {stats
          ? ` (${stats.article_count} passende gespeicherte Meldungen)`
          : ""}
        .{boundedImpactNote} Tonlabels können je Quelle unterschiedliche
        dokumentierte Methoden verwenden; Aufmerksamkeit ist eine zeitlich
        abnehmende redaktionelle Heuristik, keine Kursprognose.
      </p>
    </section>
  );
}
