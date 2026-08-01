export type Sentiment = "positive" | "negative" | "neutral";
export type Urgency = "breaking" | "high" | "medium" | "low";

export type Article = {
  id: number;
  external_id: string;
  provider?: string | null;
  provider_article_id?: string | null;
  is_demo?: boolean;
  title: string;
  description: string;
  article_url: string;
  source: string;
  source_country?: string | null;
  language?: string | null;
  image_url?: string | null;
  published_at: string;
  sentiment: Sentiment;
  sentiment_confidence: number;
  positive_probability: number;
  negative_probability: number;
  neutral_probability: number;
  impact_score: number;
  urgency: Urgency;
  tickers: string[];
  sector?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  region?: string | null;
  geography_confidence?: string | null;
  geography_reason?: string | null;
  geography_is_inferred?: boolean | null;
  sentiment_source?: string | null;
  tone_method?: string;
  tone_kind?: "article_tone" | "model_inference" | "demo" | "fallback";
  impact_score_base?: number | null;
  impact_method?: "editorial_attention_heuristic_v2";
};

export type Stats = {
  article_count: number;
  article_count_24h: number | null;
  sentiment_distribution: Record<Sentiment, number>;
  average_impact: number;
  top_ticker: string | null;
  top_tickers: { ticker: string; count: number }[];
  window_hours: number;
  effective_window_hours: number;
  window_start: string;
  window_end: string;
  timestamp_field: "published_at";
  sample_size: number;
  tone_scope: string;
};

export type ConnectionStatus = "connecting" | "live" | "polling" | "offline";

export type ApiProblemKind =
  | "validation"
  | "client"
  | "unavailable"
  | "server"
  | "contract"
  | "configuration"
  | "unknown";

export type ApiProblem = {
  kind: ApiProblemKind;
  endpoint: string;
  message: string;
  status?: number;
  detail?: string;
  fieldErrors?: string[];
};

export type EndpointPhase =
  "idle" | "loading" | "ready" | "refreshing" | "error";

export type EndpointState<T> = {
  data: T | null;
  phase: EndpointPhase;
  error: ApiProblem | null;
  lastSuccessAt: number | null;
};

export type NewsRevision = {
  latest_published_at: string | null;
  article_count: number;
  revision: string;
};

export type NewsPage = {
  items: Article[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_cursor?: string | null;
  window_hours: number;
  effective_window_hours: number;
  window_start: string;
  window_end: string;
  timestamp_field: "published_at";
};

export type AnalysisDataset = {
  articles: Article[];
  total_matching: number;
  sample_size: number;
  sample_limit: number;
  truncated: boolean;
  window_hours: number;
  effective_window_hours: number;
  window_start: string;
  window_end: string;
  timestamp_field: "published_at";
};

export type IngestionStatus = {
  status:
    | "never_run"
    | "queued"
    | "running"
    | "complete"
    | "partial"
    | "failed"
    | "cancelled";
  provider: string | null;
  job_id?: number | null;
  queue_status?: string | null;
  worker_status?: "ready" | "stale" | "unknown";
  last_started_at: string | null;
  last_completed_at: string | null;
  last_successful_at: string | null;
  records_inserted: number;
  request_count?: number;
  successful_windows?: number;
  failed_windows?: number;
  warning_count?: number;
};
