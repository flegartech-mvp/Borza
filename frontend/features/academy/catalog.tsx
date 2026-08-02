"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Route,
  Sparkles,
} from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { DegradedState, Skeleton } from "@/components/ui";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import { DEMO_MODULES } from "@/lib/demo-academy";
import { useLearningPaths } from "./use-academy-content";

export function CourseCatalogue() {
  const { dictionary, language } = usePreferences();
  const { state } = useDemoWorkspace();
  const { paths, isLoading, error, usingFallback } = useLearningPaths();
  const orderedPaths = [...paths].sort((a, b) =>
    a.id === "path-risk-management"
      ? -1
      : b.id === "path-risk-management"
        ? 1
        : 0,
  );
  const flagship = {
    de: "Flaggschiff",
    sl: "Osrednja pot",
    en: "Flagship",
  }[language];
  return (
    <>
      <PageHeading
        eyebrow={dictionary.learn.skillMap}
        title={dictionary.learn.title}
        description={dictionary.learn.intro}
      />
      {error && usingFallback ? (
        <DegradedState
          className="mb-5 min-h-24"
          title={dictionary.common.localDemo}
          description="The Academy API is unavailable, so the complete demo path remains usable."
        />
      ) : null}
      {isLoading && !paths.length ? <Skeleton className="h-64" /> : null}
      <section
        className="grid gap-4 md:grid-cols-2"
        aria-label={dictionary.learn.activePaths}
      >
        {orderedPaths.map((path, index) => (
          <article
            key={path.id}
            className={`rounded-[var(--radius-md)] border bg-[var(--surface-1)] p-6 ${path.id === "path-risk-management" ? "border-[var(--brand)] shadow-[var(--shadow-card)]" : "border-[var(--border-subtle)]"}`}
          >
            <div className="flex items-center justify-between">
              <span className="numeric text-xs text-[var(--text-tertiary)]">
                0{index + 1}
              </span>
              <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">
                {path.id === "path-risk-management"
                  ? flagship
                  : dictionary.learn.available}
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold">
              {path.title[language]}
            </h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--text-secondary)]">
              {path.summary[language]}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {path.previewTopics[language].slice(0, 4).map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                >
                  {topic}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1">
                <Clock3 aria-hidden="true" size={14} />
                {path.estimatedMinutes} {dictionary.learn.minutes}
              </span>
              <span>
                {path.lessonCount} {dictionary.learn.lessons}
              </span>
            </div>
            <Link
              href={`/learn/${path.id}`}
              className="mt-6 inline-flex items-center gap-2 font-semibold text-[var(--brand)]"
            >
              {dictionary.learn.openPath}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </article>
        ))}
      </section>
      <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--background-raised)] p-5 sm:p-8">
        <div className="flex items-center gap-3">
          <Route aria-hidden="true" className="text-[var(--electric)]" />
          <div>
            <h2 className="text-xl font-semibold">
              {dictionary.learn.skillMap}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {dictionary.learn.intro}
            </p>
          </div>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {DEMO_MODULES.map((module, index) => {
            const complete = index === 0 && state.completedLessons.length > 0;
            const current = index === 0 && !complete;
            return (
              <Link
                key={module.id}
                href={`/learn/path-finance-foundations/${module.id}`}
                className={`relative rounded-[var(--radius-md)] border p-4 ${complete ? "border-[var(--positive)] bg-[var(--positive-soft)]" : current ? "border-[var(--electric)] bg-[var(--electric-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)]"}`}
              >
                <span className="grid size-8 place-items-center rounded-full bg-[var(--surface-2)]">
                  {complete ? (
                    <CheckCircle2
                      aria-hidden="true"
                      size={17}
                      className="text-[var(--positive)]"
                    />
                  ) : current ? (
                    <Sparkles
                      aria-hidden="true"
                      size={16}
                      className="text-[var(--electric)]"
                    />
                  ) : (
                    <LockKeyhole
                      aria-hidden="true"
                      size={15}
                      className="text-[var(--text-tertiary)]"
                    />
                  )}
                </span>
                <p className="mt-4 text-sm font-semibold">
                  {module.title[language]}
                </p>
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  {complete
                    ? dictionary.learn.mastered
                    : current
                      ? dictionary.learn.current
                      : dictionary.learn.locked}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
