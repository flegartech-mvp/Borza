import { Rating, createEmptyCard, fsrs, type Card, type Grade } from "ts-fsrs";
import type { SerializedReviewCard } from "@/lib/academy-types";

const scheduler = fsrs({ enable_fuzz: false, maximum_interval: 36500 });

export function restoreReviewCard(saved: SerializedReviewCard | undefined, now: Date): Card {
  if (!saved) return createEmptyCard(now);
  return {
    due: new Date(saved.due),
    stability: saved.stability,
    difficulty: saved.difficulty,
    elapsed_days: saved.elapsedDays,
    scheduled_days: saved.scheduledDays,
    learning_steps: saved.learningSteps,
    reps: saved.reps,
    lapses: saved.lapses,
    state: saved.state,
    last_review: saved.lastReview ? new Date(saved.lastReview) : undefined,
  } as Card;
}

export function scheduleReview(cardId: string, previous: SerializedReviewCard | undefined, rating: Grade, now: Date): SerializedReviewCard {
  const result = scheduler.next(restoreReviewCard(previous, now), now, rating);
  return {
    cardId,
    due: result.card.due.toISOString(),
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    elapsedDays: result.card.elapsed_days,
    scheduledDays: result.card.scheduled_days,
    learningSteps: result.card.learning_steps,
    reps: result.card.reps,
    // The API records every explicit Again response as a lapse, including
    // learning-state failures where FSRS itself keeps Card.lapses unchanged.
    lapses: rating === Rating.Again ? (previous?.lapses ?? 0) + 1 : result.card.lapses,
    state: result.card.state,
    lastReview: result.card.last_review?.toISOString() ?? now.toISOString(),
    history: [...(previous?.history ?? []), { rating, reviewedAt: now.toISOString(), due: result.card.due.toISOString() }],
  };
}
