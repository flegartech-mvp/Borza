import { Database, Landmark } from "lucide-react";
import type { GeographySelection } from "@/lib/geography";

type MacroCountryPanelProps = {
  selection: GeographySelection;
};

const metrics = [
  {
    label: "Interest rate",
    explanation: "Central-bank policy rate",
  },
  {
    label: "GDP growth",
    explanation: "Latest reported period",
  },
  {
    label: "Inflation",
    explanation: "Consumer-price trend",
  },
  {
    label: "Unemployment",
    explanation: "Latest reported period",
  },
] as const;

export function MacroCountryPanel({ selection }: MacroCountryPanelProps) {
  return (
    <section
      aria-labelledby="macro-country-title"
      className="flex min-h-[430px] min-w-0 flex-col bg-[var(--panel)]"
    >
      <div className="border-b border-[var(--line)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--accent)]">
              {selection.label}
            </p>
            <h3
              id="macro-country-title"
              className="mt-1 text-base font-semibold tracking-tight"
            >
              Macro context
            </h3>
          </div>
          <Landmark
            aria-hidden="true"
            size={18}
            className="text-[var(--muted)]"
          />
        </div>
      </div>

      <dl className="grid flex-1 grid-cols-2">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`px-4 py-5 ${
              index % 2 === 0 ? "border-r border-[var(--line)]" : ""
            } ${index < 2 ? "border-b border-[var(--line)]" : ""}`}
          >
            <dt className="text-xs text-[var(--muted)]">{metric.label}</dt>
            <dd className="mt-3 font-mono text-sm font-semibold">
              Unavailable
            </dd>
            <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
              {metric.explanation}
            </p>
          </div>
        ))}
      </dl>

      <div className="border-t border-[var(--line)] bg-[var(--panel-soft)] px-4 py-4">
        <div className="flex items-start gap-3">
          <Database
            aria-hidden="true"
            size={16}
            className="mt-0.5 shrink-0 text-[var(--accent)]"
          />
          <div>
            <p className="text-xs font-semibold">
              Licensed macro feed not connected
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
              Borza leaves these values empty instead of presenting invented or
              stale economic figures.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
