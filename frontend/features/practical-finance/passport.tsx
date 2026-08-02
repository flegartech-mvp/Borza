"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileDown, GraduationCap, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button, ErrorState, Skeleton, Surface } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";
import { practicalContent, practicalDisclaimer } from "./content";
import { usePracticalDemoState } from "./practical-store";
import type { CompetenceEvidence } from "./types";

const copy = {
  de: {
    eyebrow: "Nachweis statt Abzeichen",
    title: "Kompetenzpass",
    intro:
      "Eine transparente Übersicht der nachgewiesenen Finanzkompetenzen. Jede Bewertung zeigt Quelle, Version und nächste Lernhandlung.",
    export: "Drucken / als PDF speichern",
    evidence: "Evidenz",
    notStarted: "Noch nicht begonnen",
    introduced: "Eingeführt",
    practising: "In Übung",
    demonstrated: "Nachgewiesen",
    strong: "Stark",
    next: "Nächste Lernhandlung",
    source: "Letzte Evidenz",
    limitation:
      "Der Pass bestätigt Lernaktivität und Prozessqualität. Er ist kein Abschluss, keine Berufsqualifikation und keine Aussage über zukünftige Rendite.",
    load: "Der Kompetenzpass konnte nicht geladen werden.",
  },
  sl: {
    eyebrow: "Dokaz namesto značke",
    title: "Kompetenčni potni list",
    intro:
      "Pregleden prikaz dokazanih finančnih kompetenc. Vsaka ocena pokaže vir, različico in naslednji učni korak.",
    export: "Natisni / shrani kot PDF",
    evidence: "Dokazi",
    notStarted: "Še ni začeto",
    introduced: "Predstavljeno",
    practising: "Vaja",
    demonstrated: "Dokazano",
    strong: "Močno",
    next: "Naslednji učni korak",
    source: "Zadnji dokaz",
    limitation:
      "Potni list potrjuje učno dejavnost in kakovost procesa. Ni diploma, poklicna kvalifikacija ali napoved prihodnjih donosov.",
    load: "Kompetenčnega potnega lista ni bilo mogoče naložiti.",
  },
  en: {
    eyebrow: "Evidence, not badges",
    title: "Competence Passport",
    intro:
      "A transparent view of demonstrated financial competences. Every rating shows its source, version, and next learning action.",
    export: "Print / save as PDF",
    evidence: "Evidence",
    notStarted: "Not started",
    introduced: "Introduced",
    practising: "Practising",
    demonstrated: "Demonstrated",
    strong: "Strong",
    next: "Next learning action",
    source: "Latest evidence",
    limitation:
      "The passport confirms learning activity and process quality. It is not a degree, professional qualification, or evidence of future returns.",
    load: "The competence passport could not be loaded.",
  },
} as const;

type RemoteEvidence = {
  id: string;
  competence_id: string;
  source_type: string;
  source_id: string;
  content_version: string;
  score: number;
  summary: string;
  created_at: string;
};
type RemoteProfile = {
  competence_id: string;
  level:
    "not_started" | "introduced" | "practising" | "demonstrated" | "strong";
  score: number;
  evidence_count: number;
  recent_evidence: RemoteEvidence[];
};
type Profile = {
  competenceId: string;
  level: RemoteProfile["level"];
  score: number;
  evidenceCount: number;
  evidence: CompetenceEvidence[];
};

function localProfiles(evidence: CompetenceEvidence[]): Profile[] {
  return practicalContent.competences.map((definition) => {
    const items = evidence
      .filter((item) => item.competenceId === definition.id)
      .slice(0, 10);
    const score = items.length
      ? Math.round(
          items.reduce((sum, item) => sum + item.score, 0) / items.length,
        )
      : 0;
    const level: Profile["level"] = !items.length
      ? "not_started"
      : items.length === 1 || score < 45
        ? "introduced"
        : items.length < 3 || score < 65
          ? "practising"
          : items.length < 5 || score < 82
            ? "demonstrated"
            : "strong";
    return {
      competenceId: definition.id,
      level,
      score,
      evidenceCount: items.length,
      evidence: items.slice(0, 3),
    };
  });
}

export function CompetencePassport() {
  const { language } = usePreferences();
  const { user } = useAuth();
  const demo = usePracticalDemoState();
  const t = copy[language];
  const remote = useQuery({
    queryKey: ["practical-passport"],
    queryFn: () => academyApi<RemoteProfile[]>("/practical/passport"),
    enabled: Boolean(user),
    retry: 1,
  });
  const profiles: Profile[] = user
    ? (remote.data ?? []).map((item) => ({
        competenceId: item.competence_id,
        level: item.level,
        score: item.score,
        evidenceCount: item.evidence_count,
        evidence: item.recent_evidence.map((entry) => ({
          id: entry.id,
          competenceId: entry.competence_id,
          sourceType: entry.source_type as CompetenceEvidence["sourceType"],
          sourceId: entry.source_id,
          contentVersion: entry.content_version,
          score: entry.score,
          summary: entry.summary,
          createdAt: entry.created_at,
        })),
      }))
    : localProfiles(demo.evidence);
  if (user && remote.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
    );
  if (user && remote.isError)
    return (
      <ErrorState
        title={t.title}
        description={t.load}
        action={
          <button
            className="font-semibold text-[var(--brand)]"
            onClick={() => void remote.refetch()}
          >
            Retry
          </button>
        }
      />
    );
  const started = profiles.filter((item) => item.evidenceCount > 0);
  const average = started.length
    ? Math.round(
        started.reduce((sum, item) => sum + item.score, 0) / started.length,
      )
    : 0;
  const levels = {
    not_started: t.notStarted,
    introduced: t.introduced,
    practising: t.practising,
    demonstrated: t.demonstrated,
    strong: t.strong,
  };
  return (
    <>
      <div className="print:hidden">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          description={t.intro}
          actions={
            <Button variant="secondary" onClick={() => window.print()}>
              <FileDown size={17} aria-hidden="true" />
              {t.export}
            </Button>
          }
        />
      </div>
      <header className="hidden print:block">
        <h1 className="text-3xl font-semibold">Borza Academy · {t.title}</h1>
        <p>{new Date().toLocaleDateString(language)}</p>
      </header>
      <Surface className="academy-grid" padding="lg">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--brand)]">
              {started.length} / {profiles.length} competences with evidence
            </p>
            <p className="numeric mt-2 text-5xl font-semibold">{average}%</p>
          </div>
          <GraduationCap
            size={48}
            className="text-[var(--brand)]"
            aria-hidden="true"
          />
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          {t.limitation}
        </p>
      </Surface>
      <section
        className="mt-5 grid gap-4 lg:grid-cols-2"
        aria-label={t.evidence}
      >
        {profiles.map((profile) => {
          const definition = practicalContent.competences.find(
            (item) => item.id === profile.competenceId,
          )!;
          return (
            <Surface as="article" key={profile.competenceId} padding="lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand)]">
                    {levels[profile.level]}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    {definition.title[language]}
                  </h2>
                </div>
                <span className="numeric text-2xl font-semibold">
                  {profile.score}%
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {definition.description[language]}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)]"
                  style={{ width: `${profile.score}%` }}
                />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-tertiary)]">
                {t.evidence}: {profile.evidenceCount}
              </p>
              {profile.evidence[0] ? (
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t.source}:{" "}
                  {profile.evidence[0].sourceType.replaceAll("_", " ")} · v
                  {profile.evidence[0].contentVersion} ·{" "}
                  {new Date(profile.evidence[0].createdAt).toLocaleDateString(
                    language,
                  )}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                  {t.notStarted}
                </p>
              )}
              <Link
                href={definition.next_action}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] print:hidden"
              >
                {t.next}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </Surface>
          );
        })}
      </section>
      <p className="mt-6 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
        <ShieldCheck className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
        {practicalDisclaimer[language]}
      </p>
    </>
  );
}
