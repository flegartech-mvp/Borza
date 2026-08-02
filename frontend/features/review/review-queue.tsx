"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Rating, type Grade } from "ts-fsrs";
import { Brain, CheckCircle2, RotateCcw } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import type {
  LocalizedText,
  ReviewCardDefinition,
  SerializedReviewCard,
} from "@/lib/academy-types";
import { academyApi } from "@/lib/api-client";
import { DEMO_REVIEW_CARDS } from "@/lib/demo-academy";
import { scheduleReview } from "./review-scheduler";

type RemoteQueueItem = {
  card: { id: string; front: LocalizedText; back: LocalizedText };
  schedule: {
    due_at: string;
    stability: number | string;
    difficulty: number | string;
    state: string;
    reps: number;
    lapses: number;
    last_review: string | null;
  };
};
type QueueCard = {
  definition: ReviewCardDefinition;
  schedule?: SerializedReviewCard;
};

const stateNumber = (state: string) =>
  ({ new: 0, learning: 1, review: 2, relearning: 3 })[state] ?? 0;

export function queueFromBackend(items: RemoteQueueItem[]): QueueCard[] {
  return items.map((item) => ({
    definition: item.card,
    schedule: {
      cardId: item.card.id,
      due: item.schedule.due_at,
      stability: Number(item.schedule.stability),
      difficulty: Number(item.schedule.difficulty),
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: item.schedule.reps,
      lapses: item.schedule.lapses,
      state: stateNumber(item.schedule.state),
      lastReview: item.schedule.last_review ?? undefined,
      history: [],
    },
  }));
}

const ratingNames = {
  [Rating.Again]: "again",
  [Rating.Hard]: "hard",
  [Rating.Good]: "good",
  [Rating.Easy]: "easy",
} as const;
const copy = {
  de: {
    practise: "Frei üben",
    empty: "Für heute ist nichts mehr fällig.",
    stability: "Stabilität / Schwierigkeit",
    history: "Wiederholungen / Aussetzer",
    loadError: "Die Wiederholungswarteschlange konnte nicht geladen werden.",
  },
  sl: {
    practise: "Prosta vaja",
    empty: "Za danes ni več zapadlih kartic.",
    stability: "Stabilnost / težavnost",
    history: "Ponovitve / spodrsljaji",
    loadError: "Čakalne vrste za ponavljanje ni bilo mogoče naložiti.",
  },
  en: {
    practise: "Free practice",
    empty: "Nothing else is due today.",
    stability: "Stability / difficulty",
    history: "Reviews / lapses",
    loadError: "The review queue could not be loaded.",
  },
};

export function ReviewQueue() {
  const { dictionary, language } = usePreferences();
  const { mode, state, saveReviewCard } = useDemoWorkspace();
  const strings = copy[language];
  const [queueStartedAt] = useState(() => Date.now());
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const query = useQuery({
    queryKey: ["academy", "review-queue"],
    queryFn: async () =>
      queueFromBackend(
        await academyApi<RemoteQueueItem[]>("/review/queue?limit=100"),
      ),
    enabled: mode === "authenticated",
    retry: 1,
  });
  const demoDue = useMemo<QueueCard[]>(
    () =>
      DEMO_REVIEW_CARDS.map((definition) => ({
        definition,
        schedule: state.reviewCards[definition.id],
      })),
    [state.reviewCards],
  );
  const dueCards = mode === "authenticated" ? (query.data ?? []) : demoDue;
  const done = completed || (!query.isLoading && dueCards.length === 0);
  const current = dueCards[cursor];

  const grade = async (rating: Grade) => {
    if (!current) return;
    const now = new Date();
    const next = scheduleReview(
      current.definition.id,
      current.schedule,
      rating,
      now,
    );
    setSaving(true);
    try {
      await saveReviewCard(next, ratingNames[rating]);
      if (cursor + 1 >= dueCards.length) setCompleted(true);
      else {
        setCursor((value) => value + 1);
        setRevealed(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (mode === "authenticated" && query.isLoading)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  if (mode === "authenticated" && query.isError)
    return (
      <ErrorState
        title={dictionary.review.title}
        description={strings.loadError}
        action={
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="font-semibold text-[var(--brand)]"
          >
            {dictionary.common.retry}
          </button>
        }
      />
    );
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow="FSRS"
        title={dictionary.review.title}
        description={dictionary.review.intro}
      />
      {done ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--positive)] bg-[var(--positive-soft)] p-8 text-center">
          <CheckCircle2
            aria-hidden="true"
            size={36}
            className="mx-auto text-[var(--positive)]"
          />
          <h2 className="mt-4 text-2xl font-semibold">
            {dictionary.review.complete}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {strings.empty}
          </p>
          {mode === "demo" ? (
            <Button
              variant="secondary"
              className="mt-6"
              onClick={() => {
                setCursor(0);
                setCompleted(false);
                setRevealed(false);
                setPracticeMode(true);
              }}
            >
              <RotateCcw aria-hidden="true" size={16} />
              {strings.practise}
            </Button>
          ) : null}
        </section>
      ) : current ? (
        <>
          <div className="mb-4 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
            <span>
              {dictionary.review.due}: {dueCards.length}
            </span>
            <span className="numeric">
              {cursor + 1} / {dueCards.length}
            </span>
          </div>
          <section className="min-h-[360px] rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-7 shadow-[var(--shadow-card)] sm:p-10">
            <Brain aria-hidden="true" className="text-[var(--electric)]" />
            <p className="mt-7 text-xs font-semibold uppercase tracking-[.14em] text-[var(--text-tertiary)]">
              {revealed
                ? dictionary.lesson.takeaway
                : dictionary.lesson.glossary}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              {revealed
                ? current.definition.back[language]
                : current.definition.front[language]}
            </h2>
            {revealed && current.schedule ? (
              <dl className="mt-8 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-5 text-xs text-[var(--text-secondary)]">
                <div>
                  <dt>{dictionary.review.nextDue}</dt>
                  <dd className="numeric mt-1">
                    {new Date(current.schedule.due).toLocaleDateString(
                      language,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{strings.stability}</dt>
                  <dd className="numeric mt-1">
                    {current.schedule.stability.toFixed(2)} /{" "}
                    {current.schedule.difficulty.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt>{strings.history}</dt>
                  <dd className="numeric mt-1">
                    {current.schedule.reps} / {current.schedule.lapses}
                  </dd>
                </div>
                <div>
                  <dt>{dictionary.lesson.progress}</dt>
                  <dd className="numeric mt-1">
                    {current.schedule.history.length}
                  </dd>
                </div>
              </dl>
            ) : null}
          </section>
          {!revealed ? (
            <Button className="mt-5 w-full" onClick={() => setRevealed(true)}>
              {dictionary.review.reveal}
            </Button>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                disabled={saving}
                variant="danger"
                onClick={() => void grade(Rating.Again)}
              >
                {dictionary.review.again}
              </Button>
              <Button
                disabled={saving}
                variant="secondary"
                onClick={() => void grade(Rating.Hard)}
              >
                {dictionary.review.hard}
              </Button>
              <Button disabled={saving} onClick={() => void grade(Rating.Good)}>
                {dictionary.review.good}
              </Button>
              <Button
                disabled={saving}
                variant="secondary"
                onClick={() => void grade(Rating.Easy)}
              >
                {dictionary.review.easy}
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
