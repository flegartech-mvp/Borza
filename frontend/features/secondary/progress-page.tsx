"use client";

import Link from "next/link";
import {
  Award,
  BookOpenCheck,
  Brain,
  Calculator,
  ChartNoAxesCombined,
  NotebookPen,
} from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { ErrorState, Skeleton } from "@/components/ui";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";

const copy = {
  de: {
    evidence: "Evidenz für Mastery",
    lesson: "Lektionsabschluss",
    quiz: "Quizleistung",
    recall: "Abrufstärke",
    simulator: "Simulator-Disziplin",
    journal: "Reflexion im Journal",
    calculator: "Rechenpraxis",
    xp: "Erfahrungspunkte",
    level: "Lernniveau",
    goal: "Wochenziel",
    introduced: "Eingeführt",
    practising: "In Übung",
    proficient: "Sicher",
    needs: "Wiederholen",
    mastered: "Gemeistert",
    load: "Der Kontofortschritt konnte nicht geladen werden.",
  },
  sl: {
    evidence: "Dokazi obvladovanja",
    lesson: "Dokončane lekcije",
    quiz: "Uspeh v kvizih",
    recall: "Moč priklica",
    simulator: "Disciplina v simulatorju",
    journal: "Razmislek v dnevniku",
    calculator: "Računska vaja",
    xp: "Točke izkušenj",
    level: "Učna raven",
    goal: "Tedenski cilj",
    introduced: "Predstavljeno",
    practising: "Vaja",
    proficient: "Usposobljeno",
    needs: "Potrebna ponovitev",
    mastered: "Obvladano",
    load: "Napredka računa ni bilo mogoče naložiti.",
  },
  en: {
    evidence: "Mastery evidence",
    lesson: "Lesson completion",
    quiz: "Quiz performance",
    recall: "Recall strength",
    simulator: "Simulator discipline",
    journal: "Journal reflection",
    calculator: "Calculation practice",
    xp: "Experience points",
    level: "Learning level",
    goal: "Weekly goal",
    introduced: "Introduced",
    practising: "Practising",
    proficient: "Proficient",
    needs: "Needs review",
    mastered: "Mastered",
    load: "Account progress could not be loaded.",
  },
};

export function ProgressPage() {
  const { dictionary, language } = usePreferences();
  const { state, dashboard, hydrating, hydrationError, refresh } =
    useDemoWorkspace();
  const strings = copy[language];
  if (hydrating)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  if (hydrationError)
    return (
      <ErrorState
        title={dictionary.secondary.progressTitle}
        description={strings.load}
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            className="font-semibold text-[var(--brand)]"
          >
            {dictionary.common.retry}
          </button>
        }
      />
    );
  const completed = state.completedLessons.length;
  const quizValues = Object.values(state.quizScores);
  const quizAverage = quizValues.length
    ? quizValues.reduce((sum, value) => sum + value, 0) / quizValues.length
    : 0;
  const reviewValues = Object.values(state.reviewCards);
  const recalled = reviewValues.length
    ? (reviewValues.filter((card) => card.lapses === 0).length /
        reviewValues.length) *
      100
    : 0;
  const simulator = state.simulatorSummary?.processScore ?? 0;
  const journal = Math.min(100, state.journalEntries.length * 20);
  const lessonEvidence = Math.min(100, completed * 12.5);
  const evidence = [
    {
      icon: BookOpenCheck,
      label: strings.lesson,
      value: lessonEvidence,
      href: "/learn",
    },
    {
      icon: Award,
      label: strings.quiz,
      value: quizAverage,
      href: state.completedLessons[0]
        ? `/quiz/${state.completedLessons[0]}`
        : "/learn",
    },
    { icon: Brain, label: strings.recall, value: recalled, href: "/review" },
    {
      icon: ChartNoAxesCombined,
      label: strings.simulator,
      value: simulator,
      href: "/simulator",
    },
    {
      icon: NotebookPen,
      label: strings.journal,
      value: journal,
      href: "/journal",
    },
    { icon: Calculator, label: strings.calculator, value: 0, href: "/tools" },
  ];
  const overall = dashboard?.mastery.length
    ? dashboard.mastery.reduce((sum, item) => sum + item.score, 0) /
      dashboard.mastery.length
    : evidence.reduce((sum, item) => sum + item.value, 0) / evidence.length;
  const mastery =
    overall >= 85
      ? strings.mastered
      : overall >= 70
        ? strings.proficient
        : overall >= 35
          ? strings.practising
          : overall > 0
            ? strings.introduced
            : strings.needs;
  const xp =
    completed * 100 +
    quizValues.length * 30 +
    reviewValues.reduce((sum, card) => sum + card.reps * 5, 0) +
    state.journalEntries.length * 20;
  const level = Math.floor(xp / 500) + 1;
  const weeklyActivities = Math.min(
    5,
    completed + reviewValues.length + state.journalEntries.length,
  );
  return (
    <>
      <PageHeading
        eyebrow={mastery}
        title={dictionary.secondary.progressTitle}
        description={dictionary.secondary.progressIntro}
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <Overview label={strings.xp} value={xp.toLocaleString(language)} />
        <Overview label={strings.level} value={String(level)} />
        <Overview label={strings.goal} value={`${weeklyActivities} / 5`} />
      </section>
      <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-7">
        <h2 className="text-xl font-semibold">{strings.evidence}</h2>
        <p className="numeric mt-2 text-4xl font-semibold">
          {overall.toFixed(0)}%
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{mastery}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {evidence.map(({ icon: Icon, label, value, href }) => (
            <Link
              href={href}
              key={label}
              className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 hover:border-[var(--brand)]"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon
                    aria-hidden="true"
                    size={16}
                    className="text-[var(--brand)]"
                  />
                  {label}
                </span>
                <span className="numeric text-sm">{value.toFixed(0)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)]"
                  style={{ width: `${value}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function Overview({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="numeric mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
