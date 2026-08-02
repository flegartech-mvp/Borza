"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  NotebookPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state-message";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import { DEMO_CANDLES, DEMO_GLOSSARY, DEMO_MODULES } from "@/lib/demo-academy";
import { ChartLoader } from "@/features/charts/chart-loader";
import { useLesson } from "./use-academy-content";

const lessonExtensionCopy = {
  de: {
    framework: "Entscheidungsrahmen",
    reflection: "Reflexion",
    next: "Als Nächstes anwenden",
  },
  sl: {
    framework: "Okvir odločanja",
    reflection: "Refleksija",
    next: "Naslednji praktični korak",
  },
  en: {
    framework: "Decision framework",
    reflection: "Reflection",
    next: "Apply this next",
  },
} as const;

export function LessonPage({ lessonId }: { lessonId: string }) {
  const { dictionary, language } = usePreferences();
  const {
    state,
    completeLesson,
    toggleBookmark,
    saveLessonNote,
    loadLessonNote,
  } = useDemoWorkspace();
  const { lesson, isLoading } = useLesson(lessonId);
  const router = useRouter();
  const [note, setNote] = useState(state.lessonNotes[lessonId] ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const bookmarked = state.bookmarks.includes(lessonId);
  const completed = state.completedLessons.includes(lessonId);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      if (
        event.key === "ArrowRight" &&
        completed &&
        lesson?.knowledgeCheckIds?.length
      )
        router.push(`/quiz/${lesson.id}`);
      if (event.key === "ArrowLeft" && lesson)
        router.push(`/learn/${lesson.pathId}/${lesson.moduleId}`);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [completed, lesson, router]);

  useEffect(() => {
    let active = true;
    void loadLessonNote(lessonId)
      .then((value) => {
        if (active) setNote(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [lessonId, loadLessonNote]);

  if (isLoading && !lesson)
    return (
      <div
        role="status"
        className="h-[60dvh] animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-2)]"
      />
    );
  if (!lesson)
    return (
      <EmptyState
        title="Lesson not found"
        description="Return to the Academy catalogue to choose an available lesson."
      />
    );
  const quizHref = lesson.knowledgeCheckIds?.length
    ? `/quiz/${lesson.id}`
    : null;
  const glossary = lesson.resolvedGlossary?.length
    ? lesson.resolvedGlossary
    : DEMO_GLOSSARY.filter((term) => lesson.glossaryIds.includes(term.id));
  const extensionCopy = lessonExtensionCopy[language];
  const sections = [
    ["objectives", dictionary.lesson.objectives],
    ["core", dictionary.lesson.core],
    ["visual", dictionary.lesson.visual],
    ["exercise", dictionary.lesson.exercise],
    ["worked", dictionary.lesson.worked],
    ["mistake", dictionary.lesson.mistake],
    ...(lesson.sections.framework
      ? ([["framework", extensionCopy.framework]] as const)
      : []),
    ["takeaway", dictionary.lesson.takeaway],
    ...(lesson.sections.reflection
      ? ([["reflection", extensionCopy.reflection]] as const)
      : []),
    ["check", dictionary.lesson.check],
    ["cards", dictionary.lesson.cards],
    ["sources", dictionary.lesson.sources],
  ] as const;
  return (
    <>
      <div className="sticky top-[var(--topbar-height)] z-20 -mx-3 mb-4 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_94%,transparent)] px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-secondary)]">
            {lesson.title[language]}
          </span>
          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full bg-[var(--brand)]"
              style={{ width: completed ? "100%" : "42%" }}
            />
          </div>
          <span className="numeric text-xs">{completed ? "100" : "42"}%</span>
        </div>
      </div>
      <details className="mb-4 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 lg:hidden">
        <summary className="cursor-pointer font-semibold">
          {dictionary.lesson.curriculum}
        </summary>
        <nav className="mt-3 space-y-2">
          {sections.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="block rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)]"
            >
              {label}
            </a>
          ))}
        </nav>
      </details>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[230px_minmax(0,760px)_260px] lg:items-start lg:justify-center xl:grid-cols-[260px_minmax(0,820px)_300px]">
        <aside
          aria-label={dictionary.lesson.curriculum}
          className="sticky top-[calc(var(--topbar-height)+60px)] hidden max-h-[calc(100dvh-150px)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 lg:block"
        >
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--text-tertiary)]">
            {dictionary.lesson.curriculum}
          </p>
          <nav className="mt-4 space-y-1">
            {sections.map(([id, label], index) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
              >
                <span className="numeric text-[10px] text-[var(--text-tertiary)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            {DEMO_MODULES.slice(0, 3).map((module) => (
              <p
                key={module.id}
                className="mt-2 truncate text-xs text-[var(--text-tertiary)]"
              >
                {module.order}. {module.title[language]}
              </p>
            ))}
          </div>
        </aside>

        <article className="reading-surface min-w-0 rounded-[var(--radius-lg)] px-5 py-7 sm:px-9 sm:py-10 lg:px-12">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-[#087f61]">
            {dictionary.learn.title} · {lesson.durationMinutes}{" "}
            {dictionary.learn.minutes}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {lesson.title[language]}
          </h2>
          <p className="mt-4 text-base leading-7 text-[#536069]">
            {lesson.summary[language]}
          </p>

          <section
            id="objectives"
            className="mt-9 scroll-mt-32 rounded-2xl border border-[#d8d3c8] bg-white/60 p-5"
          >
            <h3 className="text-lg font-semibold">
              {dictionary.lesson.objectives}
            </h3>
            <ul className="mt-3 space-y-2">
              {lesson.objectives[language].map((objective) => (
                <li key={objective} className="flex gap-2 text-sm leading-6">
                  <CheckCircle2
                    aria-hidden="true"
                    size={17}
                    className="mt-1 shrink-0 text-[#087f61]"
                  />
                  {objective}
                </li>
              ))}
            </ul>
          </section>
          <section id="core" className="mt-10 scroll-mt-32">
            <h3 className="text-2xl font-semibold">{dictionary.lesson.core}</h3>
            <p className="mt-4 text-[16px] leading-8">
              {lesson.sections.core[language]}
            </p>
          </section>
          <section id="visual" className="mt-10 scroll-mt-32">
            <h3 className="text-2xl font-semibold">
              {dictionary.lesson.visual}
            </h3>
            <p className="mt-4 text-[16px] leading-8">
              {lesson.sections.visual[language]}
            </p>
            <div className="mt-5 overflow-hidden rounded-2xl [&_figcaption]:text-[var(--text-secondary)]">
              <ChartLoader
                candles={DEMO_CANDLES.slice(0, 20)}
                label={dictionary.practice.simulated}
              />
            </div>
          </section>
          <section
            id="exercise"
            className="mt-10 scroll-mt-32 rounded-2xl border-l-4 border-[#276fbe] bg-[#eaf3fc] p-5 text-[#192b3a]"
          >
            <h3 className="text-xl font-semibold">
              {dictionary.lesson.exercise}
            </h3>
            <p className="mt-3 leading-7">
              {lesson.sections.exercise[language]}
            </p>
            <Link
              href="/practice"
              className="mt-4 inline-flex items-center gap-2 font-semibold text-[#276fbe]"
            >
              {dictionary.nav.practice}
              <ChevronRight aria-hidden="true" size={16} />
            </Link>
          </section>
          <section id="worked" className="mt-10 scroll-mt-32">
            <h3 className="text-2xl font-semibold">
              {dictionary.lesson.worked}
            </h3>
            <p className="mt-4 text-[16px] leading-8">
              {lesson.sections.worked[language]}
            </p>
          </section>
          <section
            id="mistake"
            className="mt-10 scroll-mt-32 rounded-2xl border border-[#e3c486] bg-[#fff4dc] p-5 text-[#3e321e]"
          >
            <h3 className="font-semibold">{dictionary.lesson.mistake}</h3>
            <p className="mt-2 leading-7">
              {lesson.sections.mistake[language]}
            </p>
          </section>
          <section
            id="takeaway"
            className="mt-10 scroll-mt-32 rounded-2xl border border-[#94ccb8] bg-[#e7f6f0] p-5 text-[#18392f]"
          >
            <h3 className="font-semibold">{dictionary.lesson.takeaway}</h3>
            <p className="mt-2 leading-7">
              {lesson.sections.takeaway[language]}
            </p>
          </section>
          {lesson.sections.framework ? (
            <section
              id="framework"
              className="mt-10 scroll-mt-32 rounded-2xl border border-[#b5cce4] bg-[#eef5fb] p-5 text-[#192b3a]"
            >
              <h3 className="font-semibold">{extensionCopy.framework}</h3>
              <p className="mt-2 whitespace-pre-line leading-7">
                {lesson.sections.framework[language]}
              </p>
            </section>
          ) : null}
          {lesson.sections.reflection ? (
            <section
              id="reflection"
              className="mt-10 scroll-mt-32 rounded-2xl border border-[#c9bdde] bg-[#f4effb] p-5 text-[#302643]"
            >
              <h3 className="font-semibold">{extensionCopy.reflection}</h3>
              <p className="mt-2 leading-7">
                {lesson.sections.reflection[language]}
              </p>
              <Link
                href="/journal"
                className="mt-4 inline-flex items-center gap-2 font-semibold text-[#654a91]"
              >
                {dictionary.nav.journal}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </section>
          ) : null}
          {lesson.nextAction ? (
            <section className="mt-10 rounded-2xl bg-[#0c2f27] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8ce5c8]">
                {extensionCopy.next}
              </p>
              <Link
                href={lesson.nextAction.href}
                className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold"
              >
                {lesson.nextAction.label[language]}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </section>
          ) : null}
          <section id="check" className="mt-10 scroll-mt-32">
            <h3 className="text-2xl font-semibold">
              {dictionary.lesson.check}
            </h3>
            <p className="mt-3 leading-7">
              {lesson.sections.exercise[language]}
            </p>
            {quizHref ? (
              <Link
                href={quizHref}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087f61] px-4 font-semibold text-white"
              >
                {dictionary.quiz.title}
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            ) : (
              <p className="mt-4 text-sm text-[#536069]">
                {dictionary.common.comingNext}
              </p>
            )}
          </section>
          <section id="cards" className="mt-10 scroll-mt-32">
            <h3 className="text-2xl font-semibold">
              {dictionary.lesson.cards}
            </h3>
            <p className="mt-3 leading-7 text-[#536069]">
              {lesson.resolvedReviewCards?.length ?? 0} · FSRS
            </p>
            {lesson.resolvedReviewCards?.map((card) => (
              <details
                key={card.id}
                className="mt-3 rounded-xl border border-[#d8d3c8] p-4"
              >
                <summary className="cursor-pointer font-semibold">
                  {card.front[language]}
                </summary>
                <p className="mt-2 leading-7">{card.back[language]}</p>
              </details>
            ))}
          </section>
          <section
            id="sources"
            className="mt-10 scroll-mt-32 border-t border-[#d8d3c8] pt-7"
          >
            <h3 className="text-xl font-semibold">
              {dictionary.lesson.sources}
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              {lesson.resolvedSources?.length
                ? lesson.resolvedSources.map((source) => (
                    <li key={source.id}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-10 items-center gap-2 font-semibold text-[#087f61]"
                      >
                        <ExternalLink aria-hidden="true" size={14} />
                        <span>
                          {source.publisher ? `${source.publisher} — ` : ""}
                          {source.title}
                        </span>
                      </a>
                    </li>
                  ))
                : lesson.sourceIds.map((source) => (
                    <li key={source} className="flex items-center gap-2">
                      <ExternalLink aria-hidden="true" size={14} />
                      {source}
                    </li>
                  ))}
            </ul>
          </section>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#d8d3c8] pt-7">
            <Link
              href={`/learn/${lesson.pathId}/${lesson.moduleId}`}
              className="inline-flex items-center gap-2 font-semibold text-[#536069]"
            >
              <ChevronLeft aria-hidden="true" size={16} />
              {dictionary.common.previous}
            </Link>
            <Button
              disabled={completed}
              onClick={async () => {
                try {
                  await completeLesson(lesson.id);
                  setMessage(dictionary.common.complete);
                } catch (reason) {
                  setMessage(
                    reason instanceof Error
                      ? reason.message
                      : dictionary.auth.error,
                  );
                }
              }}
            >
              {completed
                ? dictionary.common.complete
                : dictionary.lesson.markComplete}
            </Button>
            {quizHref ? (
              <Link
                href={quizHref}
                className="inline-flex items-center gap-2 font-semibold text-[#087f61]"
              >
                {dictionary.common.next}
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            ) : null}
          </div>
          {message ? (
            <p className="mt-3 text-center text-sm" role="status">
              {message}
            </p>
          ) : null}
        </article>

        <aside
          aria-label={dictionary.lesson.notes}
          className="sticky top-[calc(var(--topbar-height)+60px)] hidden max-h-[calc(100dvh-150px)] space-y-4 overflow-y-auto lg:block"
        >
          <section className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
            <h3 className="text-sm font-semibold">
              {dictionary.lesson.glossary}
            </h3>
            {glossary.map((term) => (
              <details
                key={term.id}
                className="mt-3 border-t border-[var(--border-subtle)] pt-3"
              >
                <summary className="cursor-pointer text-sm font-semibold text-[var(--brand)]">
                  {term.term[language]}
                </summary>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {term.definition[language]}
                </p>
              </details>
            ))}
          </section>
          <section className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <NotebookPen aria-hidden="true" size={16} />
                {dictionary.lesson.notes}
              </h3>
              <button
                type="button"
                onClick={async () => {
                  await toggleBookmark(lesson.id);
                }}
                aria-label={dictionary.lesson.bookmark}
                className="grid size-10 place-items-center rounded-lg border border-[var(--border-subtle)]"
              >
                {bookmarked ? (
                  <BookmarkCheck
                    aria-hidden="true"
                    size={17}
                    className="text-[var(--brand)]"
                  />
                ) : (
                  <Bookmark aria-hidden="true" size={17} />
                )}
              </button>
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={6}
              aria-label={dictionary.lesson.notes}
              className="mt-3 w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 w-full"
              onClick={async () => {
                await saveLessonNote(lesson.id, note);
                setMessage(dictionary.common.save);
              }}
            >
              {dictionary.common.save}
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
