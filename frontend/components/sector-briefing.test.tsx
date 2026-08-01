// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SectorBriefing, buildSectorSummaries } from "./sector-briefing";
import {
  articleMatchesSelection,
  GLOBAL_SELECTION,
  makeCountrySelection,
  makeRegionSelection,
} from "@/lib/geography";
import type { Article } from "@/lib/types";

function article(id: number, overrides: Partial<Article>): Article {
  return {
    id,
    external_id: `article-${id}`,
    title: `Story ${id}`,
    description: "",
    article_url: `https://example.com/articles/${id}`,
    source: "Example News",
    published_at: "2026-07-27T12:00:00Z",
    sentiment: "neutral",
    sentiment_confidence: 0.5,
    positive_probability: 0.2,
    negative_probability: 0.2,
    neutral_probability: 0.6,
    impact_score: 50,
    urgency: "medium",
    tickers: [],
    ...overrides,
  };
}

const visibleArticles = [
  article(1, {
    title: "German technology exports rise",
    country_code: "DE",
    country_name: "Germany",
    sector: "Technology",
    tickers: ["SAP"],
    sentiment: "negative",
    impact_score: 80,
  }),
  article(2, {
    title: "German software demand stabilizes",
    country_code: "DE",
    country_name: "Germany",
    sector: "Technology",
    tickers: ["SAP", "BMW"],
    sentiment: "negative",
    impact_score: 60,
  }),
  article(3, {
    title: "Europe-wide bank outlook",
    region: "Europe",
    sector: "Financials",
    tickers: ["ASML"],
    impact_score: 40,
  }),
  article(4, {
    title: "United States energy update",
    country_code: "US",
    country_name: "United States",
    sector: "Energy",
    tickers: ["CVX"],
    impact_score: 50,
  }),
];

afterEach(() => cleanup());

describe("SectorBriefing", () => {
  it("uses every visible article for the Global scope", () => {
    render(
      <SectorBriefing
        articles={visibleArticles.filter((article) =>
          articleMatchesSelection(article, GLOBAL_SELECTION),
        )}
        scopeLabel="Global"
        scopeType="global"
        totalGlobalArticles={visibleArticles.length}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Sector analysis — Global" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Based on 4 visible stories globally."),
    ).toBeTruthy();
    expect(screen.getAllByTestId("sector-summary")).toHaveLength(3);
  });

  it("uses only Germany-selected stories for the Germany scope", () => {
    const germany = makeCountrySelection("276", "Germany");
    const scopedArticles = visibleArticles.filter((article) =>
      articleMatchesSelection(article, germany),
    );
    render(
      <SectorBriefing
        articles={scopedArticles}
        scopeLabel={germany.label}
        scopeType={germany.kind}
        totalGlobalArticles={visibleArticles.length}
      />,
    );

    expect(scopedArticles).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Sector analysis — Germany" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Based on 2 of 4 visible stories mapped to Germany."),
    ).toBeTruthy();
    expect(screen.getAllByTestId("sector-summary")).toHaveLength(1);
    expect(screen.getByText("Technology")).toBeTruthy();
    expect(screen.queryByText("Financials")).toBeNull();
  });

  it("includes country-level and region-only stories for Europe", () => {
    const europe = makeRegionSelection("europe");
    const scopedArticles = visibleArticles.filter((article) =>
      articleMatchesSelection(article, europe),
    );
    render(
      <SectorBriefing
        articles={scopedArticles}
        scopeLabel={europe.label}
        scopeType={europe.kind}
        totalGlobalArticles={visibleArticles.length}
      />,
    );

    expect(scopedArticles.map((article) => article.id)).toEqual([1, 2, 3]);
    expect(
      screen.getByText(
        "Based on 3 of 4 visible stories in Europe, including region-only stories.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Financials")).toBeTruthy();
  });

  it("calculates sector story count, impact, sentiment, and tickers from scoped data", () => {
    const technology = buildSectorSummaries(visibleArticles).find(
      (summary) => summary.sector === "Technology",
    );
    expect(technology).toMatchObject({
      storyCount: 2,
      averageImpact: 70,
      sentiment: "negative",
      topTickers: ["SAP", "BMW"],
      representativeHeadline: "German technology exports rise",
    });
  });

  it("renders proper empty states for empty selections and missing sector tags", () => {
    const empty = render(
      <SectorBriefing
        articles={[]}
        scopeLabel="Slovenia"
        scopeType="country"
        totalGlobalArticles={4}
      />,
    );
    expect(screen.getByText("No stories in Slovenia")).toBeTruthy();
    empty.unmount();

    render(
      <SectorBriefing
        articles={[article(5, { title: "Unclassified story" })]}
        scopeLabel="Global"
        scopeType="global"
        totalGlobalArticles={1}
      />,
    );
    expect(screen.getByText("No sector tags available")).toBeTruthy();
  });
});
