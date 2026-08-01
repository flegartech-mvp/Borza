// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketOverview } from "./market-overview";
import type { Stats } from "@/lib/types";

afterEach(() => cleanup());

describe("MarketOverview", () => {
  it("distinguishes the exact story count from the bounded impact sample", () => {
    const stats: Stats = {
      article_count: 1500,
      article_count_24h: 1500,
      sentiment_distribution: {
        positive: 500,
        negative: 500,
        neutral: 500,
      },
      average_impact: 42,
      top_ticker: "AAPL",
      top_tickers: [{ ticker: "AAPL", count: 12 }],
      window_hours: 999,
      effective_window_hours: 168,
      window_start: "2026-07-29T12:00:00Z",
      window_end: "2026-07-30T12:00:00Z",
      timestamp_field: "published_at",
      sample_size: 1000,
      tone_scope: "Stored labels",
    };

    render(<MarketOverview stats={stats} loading={false} />);

    expect(
      screen.getByText(/1500 matching stored stories/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Average attention uses the newest 1000 matching stories/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/1000 stored stories/)).not.toBeInTheDocument();
    expect(screen.getByText(/Rolling 168-hour scope/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Rolling 999-hour scope/),
    ).not.toBeInTheDocument();
  });
});
