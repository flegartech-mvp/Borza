import { BookOpen } from "lucide-react";

const concepts = [
  {
    term: "GDP",
    description:
      "Der Gesamtwert aller Waren und Dienstleistungen einer Volkswirtschaft.",
  },
  {
    term: "Inflation",
    description:
      "Die Rate, mit der das allgemeine Preisniveau für Waren und Dienstleistungen steigt.",
  },
  {
    term: "Zinssatz",
    description:
      "Die Kosten für geliehenes Geld, häufig beeinflusst durch Zentralbanken.",
  },
  {
    term: "Sektor",
    description:
      "Eine Gruppe von Unternehmen mit ähnlicher Geschäftstätigkeit, etwa Technologie.",
  },
  {
    term: "Ticker",
    description:
      "Ein kurzes Börsenkürzel für ein notiertes Unternehmen oder einen Vermögenswert.",
  },
  {
    term: "Artikelton",
    description:
      "Ob die Sprache einer Meldung positiv, negativ oder neutral wirkt; keine Kursprognose.",
  },
] as const;

export function LearningSection() {
  return (
    <section
      id="learn"
      aria-labelledby="learning-title"
      className="mt-8 grid scroll-mt-6 border border-[var(--line)] bg-[var(--panel)] lg:grid-cols-[0.72fr_1.28fr]"
    >
      <div className="border-b border-[var(--line)] p-5 lg:border-b-0 lg:border-r">
        <BookOpen
          aria-hidden="true"
          size={21}
          className="text-[var(--accent)]"
        />
        <h2
          id="learning-title"
          className="mt-5 text-2xl font-semibold tracking-tight"
        >
          Wichtige Begriffe des Marktes
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
          Kurze Definitionen für Begriffe aus Borzas Nachrichten- und
          Konjunkturbereichen.
        </p>
      </div>
      <dl className="grid sm:grid-cols-2">
        {concepts.map((concept, index) => (
          <div
            key={concept.term}
            className={`${index > 0 ? "border-t sm:border-t-0" : ""} ${
              index % 2 === 1 ? "sm:border-l" : ""
            } ${index >= 2 ? "sm:border-t" : ""} border-[var(--line)] p-4`}
          >
            <dt className="font-mono text-xs font-semibold text-[var(--accent)]">
              {concept.term}
            </dt>
            <dd className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {concept.description}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
