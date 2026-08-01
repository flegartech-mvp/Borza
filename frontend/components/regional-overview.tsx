import { Globe2, Landmark } from "lucide-react";

const metrics = [
  {
    label: "Interest rates",
    explanation:
      "Central-bank policy can influence borrowing costs and market expectations.",
  },
  {
    label: "Inflation",
    explanation: "Shows how quickly everyday prices are changing over time.",
  },
  {
    label: "GDP",
    explanation: "A broad measure of a region's economic activity.",
  },
  {
    label: "Unemployment",
    explanation:
      "Shows the share of people seeking work who do not have a job.",
  },
] as const;

export function RegionalOverview() {
  return (
    <section
      id="regions"
      aria-labelledby="regional-overview-title"
      className="panel mt-5 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
            <Globe2 aria-hidden="true" size={14} /> Regional overview
          </p>
          <h2
            id="regional-overview-title"
            className="mt-2 text-xl font-semibold tracking-tight"
          >
            Macro context, without pretending it is live
          </h2>
        </div>
        <span className="w-fit rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
          Macro data provider not connected
        </span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4"
          >
            <Landmark
              aria-hidden="true"
              size={17}
              className="text-violet-400"
            />
            <h3 className="mt-4 font-semibold">{metric.label}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {metric.explanation}
            </p>
            <p className="mt-4 font-mono text-xs text-[var(--muted)]">
              Data unavailable
            </p>
          </article>
        ))}
      </div>
      <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
        Connect a licensed macroeconomic data source before displaying regional
        figures, trends, or a map. Borza deliberately leaves these values empty
        instead of fabricating real-time data.
      </p>
    </section>
  );
}
