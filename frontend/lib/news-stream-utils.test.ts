import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBurstScheduler,
  createEventDedupe,
  mergeArticle,
  parseNewsSocketMessage,
  reconnectDelay,
} from "./news-stream-utils";
import type { Article } from "./types";

function article(id: number, externalId = `article-${id}`): Article {
  return {
    id,
    external_id: externalId,
    title: `Story ${id}`,
    description: "",
    article_url: `https://example.com/${id}`,
    source: "Example",
    published_at: "2026-07-28T10:00:00Z",
    sentiment: "neutral",
    sentiment_confidence: 0.5,
    positive_probability: 0.2,
    negative_probability: 0.2,
    neutral_probability: 0.6,
    impact_score: 40,
    urgency: "low",
    tickers: [],
    tone_method: "neutral_fallback",
    tone_kind: "fallback",
    impact_method: "editorial_attention_heuristic_v2",
  };
}

function createdEvent(
  id: number,
  eventId = `article.created:v1:${id}`,
  version = "2026-07-28T10:00:00Z",
) {
  return {
    type: "article.created" as const,
    schema_version: 1 as const,
    event_id: eventId,
    occurred_at: version,
    emitted_at: "2026-07-28T10:00:01Z",
    entity: {
      kind: "article" as const,
      id,
      version,
    },
    data: article(id),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("news stream validation and scheduling", () => {
  it("rejects malformed JSON and invalid message shapes without throwing", () => {
    expect(parseNewsSocketMessage("{not json")).toBeNull();
    expect(
      parseNewsSocketMessage('{"type":"article","data":{"id":1}}'),
    ).toBeNull();
    expect(parseNewsSocketMessage('{"type":"unknown"}')).toBeNull();
    expect(parseNewsSocketMessage('{"type":"ping"}')).toEqual({ type: "ping" });
  });

  it("accepts versioned and legacy article events", () => {
    const incoming = article(2, "same-external-id");
    const event = {
      ...createdEvent(2),
      data: incoming,
    };
    expect(parseNewsSocketMessage(JSON.stringify(event))).toEqual(event);
    expect(
      parseNewsSocketMessage(
        JSON.stringify({ type: "article", data: incoming }),
      ),
    ).toEqual({ type: "article", data: incoming });
    const merged = mergeArticle(
      [article(1, "same-external-id"), article(2, "old-id"), article(3)],
      incoming,
    );
    expect(merged.map((item) => item.id)).toEqual([2, 3]);
  });

  it("rejects unsupported or internally inconsistent event envelopes", () => {
    expect(
      parseNewsSocketMessage({
        ...createdEvent(1),
        schema_version: 2,
      }),
    ).toBeNull();
    expect(
      parseNewsSocketMessage({
        ...createdEvent(1),
        entity: { ...createdEvent(1).entity, id: 2 },
      }),
    ).toBeNull();
    expect(
      parseNewsSocketMessage({
        ...createdEvent(1),
        occurred_at: "not-a-date",
      }),
    ).toBeNull();
  });

  it("deduplicates event ids and stale entity versions with bounded memory", () => {
    const dedupe = createEventDedupe(2);
    expect(dedupe.accept(createdEvent(1, "event-1"))).toBe(true);
    expect(dedupe.accept(createdEvent(1, "event-1"))).toBe(false);
    expect(
      dedupe.accept(createdEvent(1, "event-2", "2026-07-28T09:59:59Z")),
    ).toBe(false);
    expect(dedupe.accept(createdEvent(2, "event-3"))).toBe(true);
    expect(dedupe.accept(createdEvent(3, "event-4"))).toBe(true);
    expect(dedupe.size).toBe(2);
  });

  it("bounds exponential reconnect delays", () => {
    expect(reconnectDelay(0, () => 0.5)).toBe(1_000);
    expect(reconnectDelay(3, () => 0.5)).toBe(8_000);
    expect(reconnectDelay(20, () => 0.5)).toBe(30_000);
    expect(reconnectDelay(20, () => 1)).toBe(30_000);
  });

  it("coalesces rapid events into one refresh and supports cleanup", () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const scheduler = createBurstScheduler(task, 1_500);
    for (let index = 0; index < 100; index += 1) scheduler.schedule();
    expect(scheduler.pending).toBe(true);
    vi.advanceTimersByTime(1_499);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledOnce();

    scheduler.schedule();
    scheduler.cancel();
    vi.runAllTimers();
    expect(task).toHaveBeenCalledOnce();
    expect(scheduler.pending).toBe(false);
  });
});
