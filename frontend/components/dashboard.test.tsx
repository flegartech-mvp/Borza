// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./dashboard";
import { OverviewWorkspace } from "@/features/workspace/data-workspaces";
import { UI_DEMO_ARTICLES } from "@/lib/demo-news";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { useNewsStream } from "@/hooks/use-news-stream";

vi.mock("@/hooks/use-news-stream", () => ({
  useNewsStream: vi.fn(),
}));

const emptyEndpoint = {
  data: null,
  phase: "ready" as const,
  error: null,
  lastSuccessAt: null,
};

beforeEach(() => {
  window.history.replaceState(
    null,
    "",
    "/?campaign=summer&window_hours=999#news",
  );
  vi.mocked(useNewsStream).mockReturnValue({
    feedState: emptyEndpoint,
    analysisState: emptyEndpoint,
    statsState: emptyEndpoint,
    freshnessState: { ...emptyEndpoint, phase: "idle" },
    status: "polling",
    refresh: vi.fn(),
    loadingMore: false,
    paginationError: null,
    loadMore: vi.fn(),
  });
});

afterEach(cleanup);

describe("Dashboard client filter validation", () => {
  it("surfaces degraded providers and stale feed metadata independently", () => {
    vi.mocked(useNewsStream).mockReturnValue({
      feedState: {
        data: {
          items: [],
          total: 0,
          limit: 12,
          offset: 0,
          has_more: false,
          window_hours: 24,
          effective_window_hours: 24,
          window_start: "2026-07-29T00:00:00Z",
          window_end: "2026-07-30T00:00:00Z",
          timestamp_field: "published_at",
          partial_results: true,
          data_freshness: "stale",
        },
        phase: "ready",
        error: null,
        lastSuccessAt: Date.now(),
      },
      analysisState: emptyEndpoint,
      statsState: emptyEndpoint,
      freshnessState: { ...emptyEndpoint, phase: "idle" },
      status: "polling",
      refresh: vi.fn(),
      loadingMore: false,
      paginationError: null,
      loadMore: vi.fn(),
    });

    render(<Dashboard />);

    expect(
      screen.getByText(/Some configured news providers were degraded/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/older than the freshness target/),
    ).toBeInTheDocument();
  });

  it("keeps invalid edits out of committed URL state and supports clearing and recovery", async () => {
    render(
      <Dashboard
        initialFilters={{
          ...DEFAULT_FILTERS,
          search: "rates",
          sentiment: "positive",
        }}
      />,
    );

    const ticker = screen.getByLabelText("Ticker");
    fireEvent.change(ticker, { target: { value: "aapl!" } });

    expect(ticker).toHaveValue("aapl!");
    expect(
      screen.getByRole("alert", { name: "Invalid filters" }),
    ).toHaveTextContent("Ticker was ignored");
    expect(vi.mocked(useNewsStream).mock.lastCall?.[0]).toMatchObject({
      search: "rates",
      sentiment: "positive",
      ticker: "",
    });
    await waitFor(() => {
      expect(window.location.search).toBe(
        "?campaign=summer&search=rates&sentiment=positive",
      );
    });
    expect(window.location.hash).toBe("#news");

    fireEvent.change(ticker, { target: { value: "" } });
    expect(
      screen.queryByRole("alert", { name: "Invalid filters" }),
    ).not.toBeInTheDocument();

    fireEvent.change(ticker, { target: { value: "$msft" } });
    expect(ticker).toHaveValue("MSFT");
    expect(vi.mocked(useNewsStream).mock.lastCall?.[0].ticker).toBe("MSFT");
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("ticker")).toBe(
        "MSFT",
      );
    });
  });

  it("rejects an out-of-range numeric edit without dropping valid filters", () => {
    render(
      <Dashboard
        initialFilters={{
          ...DEFAULT_FILTERS,
          urgency: "high",
          ticker: "AAPL",
        }}
      />,
    );

    const minimumImpact = screen.getByLabelText("Minimum base attention");
    fireEvent.change(minimumImpact, { target: { value: "101" } });

    expect(minimumImpact).toHaveValue(101);
    expect(
      screen.getByRole("alert", { name: "Invalid filters" }),
    ).toHaveTextContent("Enter a whole number from 0 to 100");
    expect(vi.mocked(useNewsStream).mock.lastCall?.[0]).toMatchObject({
      urgency: "high",
      ticker: "AAPL",
      minimum_impact: "",
    });
  });
});

describe("Overview endpoint isolation", () => {
  it("keeps successful analysis visible without mislabeling it as local demo fallback", () => {
    const liveArticle = {
      ...UI_DEMO_ARTICLES[0],
      id: 901,
      external_id: "live-analysis-story",
      is_demo: false,
      title: "Live analysis remains independently available",
    };
    vi.mocked(useNewsStream).mockReturnValue({
      feedState: {
        ...emptyEndpoint,
        phase: "error",
        error: {
          kind: "unavailable",
          endpoint: "news-page",
          message: "Feed unavailable",
        },
      },
      analysisState: {
        data: {
          articles: [liveArticle],
          total_matching: 1,
          sample_size: 1,
          sample_limit: 500,
          truncated: false,
          window_hours: 24,
          effective_window_hours: 24,
          window_start: "2026-07-29T00:00:00Z",
          window_end: "2026-07-30T00:00:00Z",
          timestamp_field: "published_at",
        },
        phase: "ready",
        error: null,
        lastSuccessAt: Date.now(),
      },
      statsState: emptyEndpoint,
      freshnessState: { ...emptyEndpoint, phase: "idle" },
      status: "polling",
      refresh: vi.fn(),
      loadingMore: false,
      paginationError: null,
      loadMore: vi.fn(),
    });

    render(<OverviewWorkspace />);

    expect(
      screen.getAllByText("Live analysis remains independently available"),
    ).not.toHaveLength(0);
    expect(
      screen.queryByRole("region", { name: "Demo data notice" }),
    ).not.toBeInTheDocument();
  });

  it("uses labeled local examples only when no live article endpoint remains", () => {
    vi.mocked(useNewsStream).mockReturnValue({
      feedState: {
        ...emptyEndpoint,
        phase: "error",
        error: {
          kind: "unavailable",
          endpoint: "news-page",
          message: "Feed unavailable",
        },
      },
      analysisState: {
        ...emptyEndpoint,
        phase: "error",
        error: {
          kind: "unavailable",
          endpoint: "analysis",
          message: "Analysis unavailable",
        },
      },
      statsState: emptyEndpoint,
      freshnessState: { ...emptyEndpoint, phase: "idle" },
      status: "polling",
      refresh: vi.fn(),
      loadingMore: false,
      paginationError: null,
      loadMore: vi.fn(),
    });

    render(<OverviewWorkspace />);

    expect(
      screen.getByRole("region", { name: "Demo data notice" }),
    ).toHaveTextContent("Simulated fallback stories");
  });
});
