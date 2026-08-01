import { isArticle } from "./api";
import type { Article } from "./types";

export type NewsSocketMessage =
  | {
      type: "article.created";
      schema_version: 1;
      event_id: string;
      occurred_at: string;
      emitted_at: string;
      entity: {
        kind: "article";
        id: number;
        version: string;
      };
      data: Article;
    }
  | { type: "article"; data: Article }
  | { type: "ping" }
  | { type: "pong" };

export type ArticleCreatedEvent = Extract<
  NewsSocketMessage,
  { type: "article.created" }
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseNewsSocketMessage(
  value: unknown,
): NewsSocketMessage | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed)) return null;
  const message = parsed;
  if (message.type === "ping" || message.type === "pong") {
    return { type: message.type };
  }
  if (
    message.type === "article.created" &&
    message.schema_version === 1 &&
    typeof message.event_id === "string" &&
    message.event_id.length > 0 &&
    message.event_id.length <= 160 &&
    isIsoDate(message.occurred_at) &&
    isIsoDate(message.emitted_at) &&
    isRecord(message.entity) &&
    message.entity.kind === "article" &&
    typeof message.entity.id === "number" &&
    Number.isInteger(message.entity.id) &&
    message.entity.id > 0 &&
    isIsoDate(message.entity.version) &&
    isArticle(message.data) &&
    message.entity.id === message.data.id
  ) {
    return message as ArticleCreatedEvent;
  }
  // Keep the pre-versioned envelope readable during rolling deployments.
  if (message.type === "article" && isArticle(message.data)) {
    return { type: "article", data: message.data };
  }
  return null;
}

export function createEventDedupe(limit = 1_000) {
  const boundedLimit = Math.max(1, Math.floor(limit));
  const eventIds = new Map<string, true>();
  const entityVersions = new Map<string, number>();

  function remember<T>(map: Map<string, T>, key: string, value: T) {
    map.delete(key);
    map.set(key, value);
    while (map.size > boundedLimit) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }

  return {
    accept(event: ArticleCreatedEvent): boolean {
      if (eventIds.has(event.event_id)) return false;
      remember(eventIds, event.event_id, true);

      const entityKey = `${event.entity.kind}:${event.entity.id}`;
      const nextVersion = Date.parse(event.entity.version);
      const previousVersion = entityVersions.get(entityKey);
      if (previousVersion !== undefined && nextVersion <= previousVersion) {
        return false;
      }
      remember(entityVersions, entityKey, nextVersion);
      return true;
    },
    get size() {
      return eventIds.size;
    },
  };
}

export function mergeArticle(
  articles: readonly Article[],
  incoming: Article,
  limit = 500,
): Article[] {
  const withoutDuplicate = articles.filter(
    (article) =>
      article.id !== incoming.id &&
      article.external_id !== incoming.external_id,
  );
  return [incoming, ...withoutDuplicate].slice(0, limit);
}

export function reconnectDelay(attempt: number, random = Math.random): number {
  const base = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
  return Math.min(30_000, Math.round(base * (0.8 + random() * 0.4)));
}

export function createBurstScheduler(task: () => void, delay = 1_500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        task();
      }, delay);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    get pending() {
      return timer !== null;
    },
  };
}
