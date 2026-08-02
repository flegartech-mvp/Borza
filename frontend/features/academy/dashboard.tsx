"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CalendarCheck2,
  ChartNoAxesCombined,
  Flame,
  NotebookPen,
  Target,
} from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Surface } from "@/components/ui/surface";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import { DEMO_LESSON, DEMO_REVIEW_CARDS } from "@/lib/demo-academy";

export function LearningDashboard() {
  const { dictionary, language } = usePreferences();
  const { state } = useDemoWorkspace();
  const completed = state.completedLessons.length;
  const due = DEMO_REVIEW_CARDS.filter(
    (card) =>
      !state.reviewCards[card.id] ||
      new Date(state.reviewCards[card.id].due) <= new Date(),
  ).length;
  const summary = state.simulatorSummary;
  const cards = [
    {
      icon: CalendarCheck2,
      label: dictionary.dashboard.reviewsDue,
      value: String(due),
      detail: due ? dictionary.nav.review : dictionary.review.complete,
      href: "/review",
    },
    {
      icon: Flame,
      label: dictionary.dashboard.streak,
      value: completed ? "2" : "0",
      detail:
        language === "de"
          ? "Lerntage"
          : language === "sl"
            ? "učna dneva"
            : "study days",
      href: "/progress",
    },
    {
      icon: Brain,
      label: dictionary.dashboard.mastery,
      value: completed ? "Introduced" : "Not started",
      detail: DEMO_REVIEW_CARDS[0].front[language],
      href: "/learn",
    },
    {
      icon: Target,
      label: dictionary.dashboard.weeklyProgress,
      value: `${Math.min(100, completed * 25)}%`,
      detail:
        language === "de"
          ? "Ziel: 4 Aktivitäten"
          : language === "sl"
            ? "Cilj: 4 dejavnosti"
            : "Goal: 4 activities",
      href: "/progress",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow={dictionary.brand.name}
        title={dictionary.dashboard.welcome}
        description={
          state.onboarding
            ? `${dictionary.onboarding.recommendation}: ${state.onboarding.recommendation.includes("risk") ? "Risk Management" : "Finance Foundations"}`
            : dictionary.onboarding.intro
        }
        actions={
          !state.onboarding ? (
            <Link
              href="/onboarding"
              className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[#044b39] px-5 font-semibold text-[#ffffff] dark:bg-[#4fe5b7] dark:text-[#06110e]"
            >
              {dictionary.common.start}
            </Link>
          ) : null
        }
      />
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Learning decisions"
      >
        {cards.map(({ icon: Icon, label, value, detail, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 hover:border-[var(--brand)]"
          >
            <Icon
              aria-hidden="true"
              size={18}
              className="text-[var(--brand)]"
            />
            <p className="mt-5 text-xs font-medium text-[var(--text-tertiary)]">
              {label}
            </p>
            <p className="numeric mt-2 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {detail}
            </p>
          </Link>
        ))}
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Surface padding="lg" className="relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-[var(--brand)]" />
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--brand)]">
            <BookOpenCheck aria-hidden="true" size={16} />
            {dictionary.dashboard.continueLearning}
          </div>
          <h2 className="mt-4 text-2xl font-semibold">
            {DEMO_LESSON.title[language]}
          </h2>
          <p className="mt-2 max-w-2xl leading-6 text-[var(--text-secondary)]">
            {DEMO_LESSON.summary[language]}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div
                className="h-full bg-[var(--brand)]"
                style={{ width: completed ? "100%" : "18%" }}
              />
            </div>
            <span className="numeric text-xs">{completed ? "100" : "18"}%</span>
          </div>
          <Link
            href={`/lesson/${DEMO_LESSON.id}`}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 font-semibold text-[var(--brand-contrast)]"
          >
            {dictionary.common.continue}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </Surface>
        <Surface padding="lg">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--electric)]">
            <ChartNoAxesCombined aria-hidden="true" size={16} />
            {dictionary.dashboard.simulator}
          </div>
          <p className="numeric mt-5 text-3xl font-semibold">
            {summary ? `${summary.processScore}%` : "—"}
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {summary
              ? `${summary.trades} trades · ${summary.ruleViolations} rule violations`
              : dictionary.simulator.warning}
          </p>
          <Link
            href="/simulator"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--electric)]"
          >
            {dictionary.common.trySimulator}
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </Surface>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Surface padding="lg">
          <div className="flex items-center gap-2 font-semibold">
            <NotebookPen
              aria-hidden="true"
              size={18}
              className="text-[var(--warning)]"
            />
            {dictionary.dashboard.journal}
          </div>
          {state.journalEntries.length ? (
            state.journalEntries.slice(0, 2).map((entry) => (
              <p
                key={entry.id}
                className="mt-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-sm"
              >
                {entry.setup} · {entry.lesson}
              </p>
            ))
          ) : (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {dictionary.journal.intro}
            </p>
          )}
          <Link
            href="/journal"
            className="mt-4 inline-flex text-sm font-semibold text-[var(--brand)]"
          >
            {dictionary.nav.journal}
          </Link>
        </Surface>
        <Surface padding="lg">
          <div className="flex items-center gap-2 font-semibold">
            <Brain
              aria-hidden="true"
              size={18}
              className="text-[var(--electric)]"
            />
            {dictionary.dashboard.weakConcepts}
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {DEMO_REVIEW_CARDS[1].front[language]} ·{" "}
            {DEMO_REVIEW_CARDS[2].front[language]}
          </p>
          <Link
            href="/review"
            className="mt-4 inline-flex text-sm font-semibold text-[var(--electric)]"
          >
            {dictionary.nav.review}
          </Link>
        </Surface>
      </section>
    </>
  );
}
