"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Target,
} from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { EmptyState, ErrorState, Skeleton, Surface } from "@/components/ui";
import { usePreferences } from "@/features/preferences";
import { useLearningPath } from "./use-academy-content";

const copy = {
  de: {
    missing: "Lernpfad nicht gefunden",
    missingBody: "Öffne den Katalog und wähle einen verfügbaren Academy-Pfad.",
    loadError: "Der Lernpfad konnte nicht geladen werden.",
    noPrerequisites:
      "Keine Vorkenntnisse erforderlich. Neugier und ein Taschenrechner genügen.",
    prerequisites: "Schließe zuerst die angegebenen Lernpfade ab.",
    completion:
      "Bearbeite die erforderlichen Lektionen, Wissenschecks und Übungen.",
    preview:
      "Dieser Pfad zeigt sein ehrliches Curriculum, ist aber noch nicht zur Bearbeitung freigegeben.",
    lessonsSoon:
      "Die detaillierten Lektionen dieses Moduls werden mit dem aktiven Pfad freigeschaltet.",
  },
  sl: {
    missing: "Učne poti ni bilo mogoče najti",
    missingBody: "Odpri katalog in izberi razpoložljivo pot Akademije.",
    loadError: "Učne poti ni bilo mogoče naložiti.",
    noPrerequisites:
      "Predznanje ni potrebno. Dovolj sta radovednost in kalkulator.",
    prerequisites: "Najprej dokončaj navedene učne poti.",
    completion: "Dokončaj zahtevane lekcije, preverjanja znanja in vaje.",
    preview:
      "Ta pot prikazuje pošten predogled učnega načrta, vendar še ni odprta za učenje.",
    lessonsSoon:
      "Podrobne lekcije tega modula se odklenejo, ko pot postane aktivna.",
  },
  en: {
    missing: "Learning path not found",
    missingBody: "Open the catalogue and choose an available Academy path.",
    loadError: "The learning path could not be loaded.",
    noPrerequisites:
      "No prior knowledge required. Curiosity and a calculator are enough.",
    prerequisites: "Complete the listed learning paths first.",
    completion:
      "Complete the required lessons, knowledge checks, and exercises.",
    preview:
      "This path shows an honest curriculum preview, but is not open for study yet.",
    lessonsSoon:
      "Detailed lessons for this module unlock when the path becomes active.",
  },
};

export function PathOverview({ pathId }: { pathId: string }) {
  const { dictionary, language } = usePreferences();
  const { path, isLoading, isError, refetch } = useLearningPath(pathId);
  const strings = copy[language];
  if (isLoading && !path)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!path)
    return (
      <EmptyState
        title={strings.missing}
        description={strings.missingBody}
        action={
          <Link href="/learn" className="font-semibold text-[var(--brand)]">
            {dictionary.learn.title}
          </Link>
        }
      />
    );
  if (isError && path.status === "active" && path.lessons.length === 0)
    return (
      <ErrorState
        title={strings.loadError}
        description={strings.missingBody}
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            className="font-semibold text-[var(--brand)]"
          >
            {dictionary.common.retry}
          </button>
        }
      />
    );
  const firstLesson = path.lessons[0];
  const active = path.status === "active";
  return (
    <>
      <PageHeading
        eyebrow={`${path.lessonCount} ${dictionary.learn.lessons} · ${path.estimatedMinutes} ${dictionary.learn.minutes}`}
        title={path.title[language]}
        description={path.summary[language]}
        actions={
          active && firstLesson ? (
            <Link
              href={`/lesson/${firstLesson.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 font-semibold text-[var(--brand-contrast)]"
            >
              {dictionary.common.start}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--warning)] bg-[var(--warning-soft)] px-4 text-sm font-semibold text-[var(--warning)]">
              <LockKeyhole aria-hidden="true" size={15} />
              {dictionary.common.comingNext}
            </span>
          )
        }
      />
      {!active ? (
        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
          {strings.preview}
        </div>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-3">
        <Surface padding="lg">
          <Target aria-hidden="true" className="text-[var(--brand)]" />
          <h3 className="mt-4 font-semibold">{dictionary.learn.objectives}</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
            {path.previewTopics[language].map((topic) => (
              <li key={topic} className="flex gap-2">
                <CheckCircle2
                  aria-hidden="true"
                  size={16}
                  className="mt-1 shrink-0 text-[var(--positive)]"
                />
                {topic}
              </li>
            ))}
          </ul>
        </Surface>
        <Surface padding="lg">
          <Clock3 aria-hidden="true" className="text-[var(--electric)]" />
          <h3 className="mt-4 font-semibold">
            {dictionary.learn.prerequisites}
          </h3>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {path.prerequisitePathIds.length
              ? strings.prerequisites
              : strings.noPrerequisites}
          </p>
          {path.prerequisitePathIds.length ? (
            <ul className="mt-2 text-xs text-[var(--text-tertiary)]">
              {path.prerequisitePathIds.map((id) => (
                <li key={id}>{id.replace("path-", "").replaceAll("-", " ")}</li>
              ))}
            </ul>
          ) : null}
        </Surface>
        <Surface padding="lg">
          <BookOpenCheck aria-hidden="true" className="text-[var(--warning)]" />
          <h3 className="mt-4 font-semibold">
            {dictionary.lesson.markComplete}
          </h3>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {strings.completion}
          </p>
          {path.completionCriteria ? (
            <p className="numeric mt-2 text-xs text-[var(--text-tertiary)]">
              {Object.entries(path.completionCriteria)
                .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`)
                .join(" · ")}
            </p>
          ) : null}
        </Surface>
      </section>
      <section className="mt-7">
        <h3 className="text-xl font-semibold">{dictionary.learn.modules}</h3>
        <div className="mt-4 space-y-3">
          {path.modules.length
            ? path.modules.map((module) =>
                active ? (
                  <Link
                    key={module.id}
                    href={`/learn/${path.id}/${module.id}`}
                    className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 hover:border-[var(--brand)]"
                  >
                    <span className="numeric grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-sm">
                      {module.order}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {module.title[language]}
                      </span>
                      <span className="mt-1 block truncate text-sm text-[var(--text-secondary)]">
                        {module.summary[language]}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      size={17}
                      className="text-[var(--text-tertiary)]"
                    />
                  </Link>
                ) : (
                  <article
                    key={module.id}
                    className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 opacity-80"
                  >
                    <span className="numeric grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-sm">
                      {module.order}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {module.title[language]}
                      </span>
                      <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                        {module.summary[language]}
                      </span>
                    </span>
                    <LockKeyhole aria-hidden="true" size={16} />
                  </article>
                ),
              )
            : path.previewTopics[language].map((topic, index) => (
                <article
                  key={topic}
                  className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
                >
                  <span className="numeric grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-sm">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{topic}</span>
                    <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                      {strings.lessonsSoon}
                    </span>
                  </span>
                  <LockKeyhole aria-hidden="true" size={16} />
                </article>
              ))}
        </div>
      </section>
    </>
  );
}

export function ModuleOverview({
  pathId,
  moduleId,
}: {
  pathId: string;
  moduleId: string;
}) {
  const { dictionary, language } = usePreferences();
  const { path, isLoading } = useLearningPath(pathId);
  const academyModule = path?.modules.find((item) => item.id === moduleId);
  if (isLoading && !path)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  if (!academyModule || !path)
    return (
      <EmptyState
        title={copy[language].missing}
        description={copy[language].missingBody}
      />
    );
  const lessons = path.lessons.filter((lesson) => lesson.moduleId === moduleId);
  return (
    <>
      <PageHeading
        eyebrow={path.title[language]}
        title={academyModule.title[language]}
        description={academyModule.summary[language]}
      />
      <div className="space-y-3">
        {lessons.length ? (
          lessons.map((lesson, index) => (
            <Link
              key={lesson.id}
              href={`/lesson/${lesson.id}`}
              className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 hover:border-[var(--brand)]"
            >
              <span className="numeric grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)]">
                {index + 1}
              </span>
              <span className="flex-1">
                <strong>{lesson.title[language]}</strong>
                <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                  {lesson.durationMinutes} {dictionary.learn.minutes} ·{" "}
                  {lesson.summary[language]}
                </span>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))
        ) : (
          <EmptyState
            title={dictionary.common.comingNext}
            description={copy[language].lessonsSoon}
          />
        )}
      </div>
    </>
  );
}
