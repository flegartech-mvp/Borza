import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import { scheduleReview } from "./review-scheduler";

describe("FSRS review scheduling", () => {
  it("creates a complete first-review schedule", () => {
    const now = new Date("2026-08-01T08:00:00.000Z");
    const next = scheduleReview("card-risk", undefined, Rating.Good, now);
    expect(next.reps).toBe(1);
    expect(next.lapses).toBe(0);
    expect(next.lastReview).toBe(now.toISOString());
    expect(Date.parse(next.due)).toBeGreaterThan(now.getTime());
    expect(next.history).toHaveLength(1);
  });

  it("preserves history and increments lapses on a subsequent Again grade", () => {
    const firstAt = new Date("2026-08-01T08:00:00.000Z");
    const first = scheduleReview("card-risk", undefined, Rating.Good, firstAt);
    const secondAt = new Date(first.due);
    const second = scheduleReview("card-risk", first, Rating.Again, secondAt);
    expect(second.reps).toBe(2);
    expect(second.lapses).toBe(1);
    expect(second.history).toHaveLength(2);
    expect(second.lastReview).toBe(secondAt.toISOString());
  });
});
