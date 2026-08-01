import { BookOpen } from "lucide-react";

const concepts = [
  {
    term: "GDP",
    description: "The total value of goods and services an economy produces.",
  },
  {
    term: "Inflation",
    description:
      "The rate at which the general price of goods and services rises.",
  },
  {
    term: "Interest rate",
    description:
      "The cost of borrowing money, often influenced by central banks.",
  },
  {
    term: "Sector",
    description:
      "A group of companies with similar business activity, such as technology.",
  },
  {
    term: "Ticker",
    description:
      "A short market code that identifies a publicly traded company or asset.",
  },
  {
    term: "Article tone",
    description:
      "Whether language in a story appears positive, negative, or neutral; it is not a price forecast.",
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
          Essential market language
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
          Short definitions for terms used throughout Borza’s news and macro
          panels.
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
