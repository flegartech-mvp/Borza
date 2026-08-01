import type {
  AnalysisDataset,
  ApiProblem,
  Article,
  IngestionStatus,
  NewsPage,
  NewsRevision,
  Stats,
} from "./types";
import { normalizeFilters, type Filters } from "./filters";
import { getApiConfig } from "./runtime-config";

export const DASHBOARD_WINDOW_HOURS = 24;
export const NEWS_PAGE_SIZE = 12;

type RequestOptions = {
  signal?: AbortSignal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export class ApiRequestError extends Error {
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem) {
    super(problem.message);
    this.name = "ApiRequestError";
    this.problem = problem;
  }
}

export function apiProblemFrom(error: unknown, endpoint: string): ApiProblem {
  if (error instanceof ApiRequestError) return error.problem;
  return {
    kind: "unknown",
    endpoint,
    message:
      error instanceof Error
        ? error.message
        : `The ${endpoint} request failed unexpectedly.`,
  };
}

export function isTrueFeedUnavailable(problem: ApiProblem | null): boolean {
  return problem?.kind === "unavailable";
}

function contractError(endpoint: string, message: string): never {
  throw new ApiRequestError({
    kind: "contract",
    endpoint,
    message,
    detail:
      "The server responded, but its data did not match the Borza frontend contract.",
  });
}

export function isArticle(value: unknown): value is Article {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.id) &&
    typeof value.external_id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.article_url === "string" &&
    typeof value.source === "string" &&
    typeof value.published_at === "string" &&
    ["positive", "negative", "neutral"].includes(String(value.sentiment)) &&
    isFiniteNumber(value.sentiment_confidence) &&
    isFiniteNumber(value.impact_score) &&
    ["breaking", "high", "medium", "low"].includes(String(value.urgency)) &&
    Array.isArray(value.tickers) &&
    value.tickers.every((ticker) => typeof ticker === "string") &&
    typeof value.tone_method === "string" &&
    ["article_tone", "model_inference", "demo", "fallback"].includes(
      String(value.tone_kind),
    ) &&
    value.impact_method === "editorial_attention_heuristic_v2"
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isScope(value: Record<string, unknown>): boolean {
  return (
    isFiniteNumber(value.window_hours) &&
    isFiniteNumber(value.effective_window_hours) &&
    isIsoDate(value.window_start) &&
    isIsoDate(value.window_end) &&
    value.timestamp_field === "published_at"
  );
}

function assertNewsPage(value: unknown): NewsPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(isArticle) ||
    !isFiniteNumber(value.total) ||
    !isFiniteNumber(value.limit) ||
    !isFiniteNumber(value.offset) ||
    typeof value.has_more !== "boolean" ||
    !isScope(value)
  ) {
    contractError("market feed", "The market feed returned an invalid page.");
  }
  return value as NewsPage;
}

function assertAnalysis(value: unknown): AnalysisDataset {
  if (
    !isRecord(value) ||
    !Array.isArray(value.articles) ||
    !value.articles.every(isArticle) ||
    !isFiniteNumber(value.total_matching) ||
    !isFiniteNumber(value.sample_size) ||
    !isFiniteNumber(value.sample_limit) ||
    typeof value.truncated !== "boolean" ||
    !isScope(value)
  ) {
    contractError(
      "market analysis",
      "The market analysis returned an invalid dataset.",
    );
  }
  return value as AnalysisDataset;
}

function assertStats(value: unknown): Stats {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.article_count) ||
    !(
      value.article_count_24h === null ||
      isFiniteNumber(value.article_count_24h)
    ) ||
    !isRecord(value.sentiment_distribution) ||
    !isFiniteNumber(value.average_impact) ||
    !Array.isArray(value.top_tickers) ||
    !isFiniteNumber(value.sample_size) ||
    typeof value.tone_scope !== "string" ||
    !isScope(value)
  ) {
    contractError(
      "market statistics",
      "The market statistics returned invalid data.",
    );
  }
  return value as Stats;
}

function queryString(
  params: Filters,
  additions: Record<string, string>,
): string {
  const search = new URLSearchParams({
    window_hours: String(DASHBOARD_WINDOW_HOURS),
  });
  const normalized = normalizeFilters(params).filters;
  for (const [key, value] of Object.entries({
    ...normalized,
    ...additions,
  })) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

async function requestJson(
  path: string,
  endpoint: string,
  options: RequestOptions = {},
): Promise<unknown> {
  const apiConfig = getApiConfig();
  if (apiConfig.value === null) {
    throw new ApiRequestError({
      kind: "configuration",
      endpoint,
      message: `The ${endpoint} endpoint is not configured correctly.`,
      detail: apiConfig.issue ?? undefined,
    });
  }

  let response: Response;
  try {
    response = await fetch(`${apiConfig.value}${path}`, {
      cache: "no-store",
      signal: options.signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiRequestError({
      kind: "unavailable",
      endpoint,
      message: `The ${endpoint} endpoint could not be reached.`,
      detail:
        error instanceof Error
          ? error.message
          : "Check the API URL and network connection.",
    });
  }

  if (!response.ok) {
    let payload: unknown;
    try {
      const body = await response.text();
      if (!body) {
        payload = null;
      } else {
        try {
          payload = JSON.parse(body);
        } catch {
          payload = body;
        }
      }
    } catch {
      payload = null;
    }
    const detailValue =
      isRecord(payload) && "detail" in payload ? payload.detail : payload;
    const fieldErrors = Array.isArray(detailValue)
      ? detailValue.flatMap((entry) => {
          if (!isRecord(entry) || typeof entry.msg !== "string") return [];
          const location = Array.isArray(entry.loc)
            ? entry.loc
                .filter(
                  (part) => typeof part === "string" || isFiniteNumber(part),
                )
                .join(".")
            : "";
          return [`${location ? `${location}: ` : ""}${entry.msg}`];
        })
      : undefined;
    const detail =
      typeof detailValue === "string"
        ? detailValue
        : fieldErrors?.length
          ? fieldErrors.join("; ")
          : undefined;
    const unavailable = [502, 503, 504].includes(response.status);
    const validation = response.status === 400 || response.status === 422;
    const client = response.status >= 400 && response.status < 500;
    throw new ApiRequestError({
      kind: unavailable
        ? "unavailable"
        : validation
          ? "validation"
          : client
            ? "client"
            : "server",
      endpoint,
      status: response.status,
      message: unavailable
        ? `The ${endpoint} service is temporarily unavailable.`
        : validation
          ? `The ${endpoint} request contains invalid filters.`
          : client
            ? `The ${endpoint} request was rejected (${response.status}).`
            : `The ${endpoint} service failed (${response.status}).`,
      detail,
      fieldErrors: fieldErrors?.length ? fieldErrors : undefined,
    });
  }

  try {
    return await response.json();
  } catch {
    contractError(endpoint, `The ${endpoint} returned invalid JSON.`);
  }
}

export async function getNewsRevision(
  params: Filters,
  options: RequestOptions = {},
): Promise<NewsRevision> {
  const query = queryString(params, {});
  const data = await requestJson(
    `/api/news-revision?${query}`,
    "market feed revision",
    options,
  );
  if (!isRecord(data) || typeof data.revision !== "string") {
    contractError("market feed revision", "Invalid revision response.");
  }
  return data as NewsRevision;
}

export async function getNewsPage(
  params: Filters,
  cursorOrOffset: string | number = 0,
  options: RequestOptions = {},
): Promise<NewsPage> {
  const additions: Record<string, string> = {
    limit: String(NEWS_PAGE_SIZE),
  };
  if (typeof cursorOrOffset === "string") {
    additions.cursor = cursorOrOffset;
  } else {
    additions.offset = String(cursorOrOffset);
  }
  const query = queryString(params, additions);
  return assertNewsPage(
    await requestJson(`/api/news-page?${query}`, "market feed", options),
  );
}

export async function getAnalysis(
  params: Filters,
  options: RequestOptions = {},
): Promise<AnalysisDataset> {
  const query = queryString(params, { sample_limit: "500" });
  return assertAnalysis(
    await requestJson(`/api/analysis?${query}`, "market analysis", options),
  );
}

export async function getStats(
  params: Filters,
  options: RequestOptions = {},
): Promise<Stats> {
  const query = queryString(params, {});
  return assertStats(
    await requestJson(`/api/stats?${query}`, "market statistics", options),
  );
}

export async function getIngestionStatus(
  options: RequestOptions = {},
): Promise<IngestionStatus> {
  const value = await requestJson(
    "/api/ingestion-status",
    "news freshness",
    options,
  );
  if (
    !isRecord(value) ||
    ![
      "never_run",
      "queued",
      "running",
      "complete",
      "partial",
      "failed",
      "cancelled",
    ].includes(String(value.status)) ||
    !(value.provider === null || typeof value.provider === "string") ||
    !(
      value.last_successful_at === null || isIsoDate(value.last_successful_at)
    ) ||
    !(value.last_started_at === null || isIsoDate(value.last_started_at)) ||
    !(value.last_completed_at === null || isIsoDate(value.last_completed_at)) ||
    !isFiniteNumber(value.records_inserted)
  ) {
    contractError(
      "news freshness",
      "The news freshness endpoint returned invalid data.",
    );
  }
  return value as IngestionStatus;
}
