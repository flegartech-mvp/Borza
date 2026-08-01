import { describe, expect, it } from "vitest";
import {
  articleMatchesSelection,
  GLOBAL_SELECTION,
  makeCountrySelection,
  makeRegionSelection,
} from "./geography";
import { aggregateArticlesByGeography } from "./geography-aggregation";
import type { Article, Sentiment } from "./types";

function article(
  id: number,
  overrides: Partial<Article> & {
    sentiment?: Sentiment;
    impact_score?: number;
  },
): Article {
  return {
    id,
    external_id: `article-${id}`,
    title: "Market update",
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

const stories = [
  article(1, {
    title: "Apple expands production in China",
    tickers: ["AAPL"],
    sentiment: "negative",
    impact_score: 80,
  }),
  article(2, {
    country_code: "CN",
    country_name: "China",
    sentiment: "negative",
    impact_score: 60,
  }),
  article(3, {
    title: "German inflation falls",
    sentiment: "negative",
    impact_score: 40,
  }),
  article(4, { region: "Europe", title: "Regional outlook" }),
  article(5, { title: "Amazon cloud earnings rise" }),
];

describe("geography aggregation", () => {
  it("counts only atlas-representable subject countries as mapped stories", () => {
    const aggregation = aggregateArticlesByGeography(stories);
    expect(aggregation.totalArticles).toBe(5);
    expect(aggregation.mappedCountryArticles).toBe(3);
    expect(aggregation.regionOnlyArticles).toBe(1);
    expect(aggregation.unmappedArticles).toBe(1);
  });

  it("produces correct country counts, dominant sentiment, impact, and inferred markers", () => {
    const aggregation = aggregateArticlesByGeography(stories);
    expect(aggregation.countryArticleCounts.get("CN")).toBe(2);
    expect(aggregation.countryArticleCounts.get("DE")).toBe(1);
    expect(aggregation.dominantSentimentByCountry.get("CN")).toBe("negative");
    expect(aggregation.averageImpactByCountry.get("CN")).toBe(70);
    expect(aggregation.inferredCountryArticleCounts.get("CN")).toBe(1);
  });

  it("keeps region-only stories in region selections and out of country selections", () => {
    const europe = makeRegionSelection("europe");
    const china = makeCountrySelection("156", "China");
    const aggregation = aggregateArticlesByGeography(stories);

    expect(
      aggregation.articlesByRegion.get("europe")?.map((story) => story.id),
    ).toEqual([3, 4]);
    expect(
      stories
        .filter((story) => articleMatchesSelection(story, europe))
        .map((story) => story.id),
    ).toEqual([3, 4]);
    expect(
      stories
        .filter((story) => articleMatchesSelection(story, china))
        .map((story) => story.id),
    ).toEqual([1, 2]);
  });

  it("uses subject geography rather than conflicting company domicile for country filtering", () => {
    const china = makeCountrySelection("156", "China");
    const unitedStates = makeCountrySelection(
      "840",
      "United States of America",
    );
    expect(articleMatchesSelection(stories[0], china)).toBe(true);
    expect(articleMatchesSelection(stories[0], unitedStates)).toBe(false);
  });

  it("resets to Global and safely produces an empty country selection", () => {
    const unitedStates = makeCountrySelection(
      "840",
      "United States of America",
    );
    expect(
      stories.filter((story) =>
        articleMatchesSelection(story, GLOBAL_SELECTION),
      ),
    ).toHaveLength(5);
    expect(makeRegionSelection("global")).toEqual(GLOBAL_SELECTION);
    expect(
      stories.filter((story) => articleMatchesSelection(story, unitedStates)),
    ).toHaveLength(0);
  });
});
