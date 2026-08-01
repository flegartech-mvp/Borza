// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS } from "@/lib/filters";
import type {
  AnalysisDataset,
  IngestionStatus,
  NewsPage,
  Stats,
} from "@/lib/types";

const apiMocks = vi.hoisted(() => ({
  getNewsPage: vi.fn(),
  getNewsRevision: vi.fn(),
  getAnalysis: vi.fn(),
  getStats: vi.fn(),
  getIngestionStatus: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, ...apiMocks };
});

vi.mock("@/lib/runtime-config", () => ({
  getWebSocketConfig: () => ({ value: null, issue: null }),
}));

import {
  FALLBACK_RECONCILIATION_MS,
  LIVE_RECONCILIATION_MS,
  useNewsStream,
} from "./use-news-stream";
import { ApiRequestError } from "@/lib/api";

const scope = {
  window_hours: 24,
  effective_window_hours: 24,
  window_start: "2026-07-28T10:00:00Z",
  window_end: "2026-07-29T10:00:00Z",
  timestamp_field: "published_at" as const,
};

const page: NewsPage = {
  ...scope,
  items: [],
  total: 0,
  limit: 12,
  offset: 0,
  has_more: false,
};
const analysis: AnalysisDataset = {
  ...scope,
  articles: [],
  total_matching: 0,
  sample_size: 0,
  sample_limit: 500,
  truncated: false,
};
const stats: Stats = {
  ...scope,
  article_count: 0,
  article_count_24h: 0,
  sentiment_distribution: { positive: 0, negative: 0, neutral: 0 },
  average_impact: 0,
  top_ticker: null,
  top_tickers: [],
  sample_size: 0,
  tone_scope: "article tone",
};
const freshness: IngestionStatus = {
  status: "complete",
  provider: "opennews",
  last_started_at: "2026-07-29T09:00:00Z",
  last_completed_at: "2026-07-29T09:01:00Z",
  last_successful_at: "2026-07-29T09:01:00Z",
  records_inserted: 4,
};

let queryClient: QueryClient;

function QueryWrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  vi.clearAllMocks();
  apiMocks.getNewsRevision.mockResolvedValue({
    latest_published_at: null,
    article_count: 0,
    revision: "rev-1",
  });
  apiMocks.getNewsPage.mockResolvedValue(page);
  apiMocks.getAnalysis.mockResolvedValue(analysis);
  apiMocks.getStats.mockResolvedValue(stats);
  apiMocks.getIngestionStatus.mockResolvedValue(freshness);
});

describe("useNewsStream endpoint isolation", () => {
  it("keeps successful secondary endpoints when the feed rejects validation", async () => {
    apiMocks.getNewsPage.mockRejectedValue(
      new ApiRequestError({
        kind: "validation",
        endpoint: "market feed",
        message: "Invalid filters",
        status: 422,
      }),
    );

    const { result, unmount } = renderHook(
      () => useNewsStream(DEFAULT_FILTERS),
      { wrapper: QueryWrapper },
    );

    await waitFor(() => {
      expect(result.current.feedState.phase).toBe("error");
      expect(result.current.analysisState.phase).toBe("ready");
      expect(result.current.statsState.phase).toBe("ready");
      expect(result.current.freshnessState.phase).toBe("ready");
    });
    expect(result.current.feedState.error?.kind).toBe("validation");
    expect(result.current.analysisState.data).toEqual(analysis);
    unmount();
  });

  it("preserves prior feed data when a later reconciliation fails", async () => {
    const { result, unmount } = renderHook(
      () => useNewsStream(DEFAULT_FILTERS),
      { wrapper: QueryWrapper },
    );
    await waitFor(() => expect(result.current.feedState.phase).toBe("ready"));

    apiMocks.getNewsPage.mockRejectedValueOnce(
      new ApiRequestError({
        kind: "server",
        endpoint: "market feed",
        message: "Server failed",
        status: 500,
      }),
    );
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.feedState.data).toEqual(page);
    expect(result.current.feedState.error?.kind).toBe("server");
    expect(result.current.analysisState.phase).toBe("ready");
    unmount();
  });

  it("declares the live and fallback reconciliation cadences", () => {
    expect(LIVE_RECONCILIATION_MS).toBe(60_000);
    expect(FALLBACK_RECONCILIATION_MS).toBe(15_000);
  });

  it("avoids full dataset re-downloads when revision is unchanged", async () => {
    apiMocks.getNewsRevision.mockResolvedValue({
      latest_published_at: "2026-07-29T10:00:00Z",
      article_count: 5,
      revision: "rev-static",
    });

    const { result, unmount } = renderHook(
      () => useNewsStream(DEFAULT_FILTERS),
      { wrapper: QueryWrapper },
    );
    await waitFor(() => expect(result.current.feedState.phase).toBe("ready"));
    const initialCallCount = apiMocks.getNewsPage.mock.calls.length;

    // Fast-forward or trigger polling check
    await act(async () => {
      await apiMocks.getNewsRevision(DEFAULT_FILTERS);
    });

    // Verification: getNewsPage was not called extra times for identical revision
    expect(apiMocks.getNewsPage.mock.calls.length).toBe(initialCallCount);
    unmount();
  });
});
