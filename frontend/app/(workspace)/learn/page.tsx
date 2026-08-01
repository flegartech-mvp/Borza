import type { Metadata } from "next";
import { LearningSection } from "@/components/learning-section";
import { SectionHeader, Surface } from "@/components/ui";

export const metadata: Metadata = {
  title: "Lernen | Borza",
  description:
    "Finanznachrichten mit wirtschaftlichen Konzepten, Quellen und methodischen Hinweisen verstehen.",
};

const methods = [
  {
    title: "Artikelton",
    body: "Ein Label für die Sprache einer Meldung. Es beschreibt den Text, nicht die erwartete Kursrichtung.",
  },
  {
    title: "Redaktionelle Aufmerksamkeit",
    body: "Eine zeitlich abnehmende Heuristik zur Priorisierung von Meldungen. Sie ist weder Renditeprognose noch Handelssignal.",
  },
  {
    title: "Quellenqualität",
    body: "Jede Meldung behält Anbieter und Veröffentlichungsquelle, damit die Originalquelle prüfbar bleibt.",
  },
  {
    title: "Demo und Aktualität",
    body: "Simulierte, veraltete, partielle und getrennte Zustände sind gekennzeichnet, weil die Einordnung von der Datenherkunft abhängt.",
  },
] as const;

export default function LearnPage() {
  return (
    <>
      <SectionHeader
        eyebrow="Borza Learn"
        title="Finanznachrichten mit Kontext verstehen"
        description="Borza erklärt Methoden, wirtschaftliche Begriffe und Einschränkungen, ohne Metadaten als Anlageberatung darzustellen."
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
