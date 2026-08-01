import type { Metadata } from "next";
import { LearningSection } from "@/components/learning-section";
import { SectionHeader, Surface } from "@/components/ui";

export const metadata: Metadata = {
  title: "Learn | Borza",
  description:
    "Understand Borza's article-tone, attention, source, demo-data, and freshness language.",
};

const methods = [
  {
    title: "Article tone",
    body: "A label for the language used in a story. It describes text, not expected price direction.",
  },
  {
    title: "Editorial attention",
    body: "A decaying heuristic for prioritizing coverage. It is not a return forecast or investment signal.",
  },
  {
    title: "Source quality",
    body: "Every story retains its provider and publication source so you can inspect the original reporting.",
  },
  {
    title: "Demo and freshness",
    body: "Simulated, stale, partial, and disconnected states are labeled because interpretation depends on data provenance.",
  },
] as const;

export default function LearnPage() {
  return (
    <>
      <SectionHeader
        eyebrow="Learning workspace"
        title="Read financial news with context"
        description="Borza explains the methods and caveats behind its interface so beginners can build judgment without mistaking metadata for advice."
      />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {methods.map((method) => (
          <Surface key={method.title} as="article" level={1} padding="lg">
            <h2 className="text-base font-semibold">{method.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {method.body}
            </p>
          </Surface>
        ))}
      </div>
      <LearningSection />
    </>
  );
}
