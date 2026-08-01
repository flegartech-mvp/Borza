import { describe, expect, it } from "vitest";
import {
  articleMatchesSelection,
  getArticleGeography,
  makeCountrySelection,
} from "./geography";
import type { Article } from "./types";

function article(overrides: Partial<Article>): Article {
  return {
    id: 1,
    external_id: "test-article",
    title: "Market update",
    description: "",
    article_url: "https://example.com/article",
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

describe("article geography inference", () => {
  it("keeps China as the subject when an Apple story is about China", () => {
    const geography = getArticleGeography(
      article({
        title: "Apple expands production in China",
        tickers: ["AAPL"],
      }),
    );

    expect(geography.subjectCountryCode).toBe("CN");
    expect(geography.companyCountryCode).toBe("US");
    expect(geography.reason).toBe("strong_title_keyword");
    expect(
      geography.conflicts.map((conflict) => conflict.countryCode),
    ).toContain("US");
  });

  it("recognizes United States signals even when punctuation follows the abbreviation", () => {
    for (const signal of [
      "US",
      "USA",
      "U.S.",
      "U.S.A.",
      "United States",
      "United States of America",
      "American",
      "Federal Reserve",
      "Fed",
      "Wall Street",
    ]) {
      expect(
        getArticleGeography(article({ title: `${signal} policy update` }))
          .subjectCountryCode,
      ).toBe("US");
    }
    expect(
      getArticleGeography(
        article({
          title: "Nvidia faces U.S. export restrictions",
          tickers: ["NVDA"],
        }),
      ).subjectCountryCode,
    ).toBe("US");
  });

  it("maps strong country and region signals without forcing a country for the ECB", () => {
    expect(
      getArticleGeography(article({ title: "German inflation falls" }))
        .subjectCountryCode,
    ).toBe("DE");
    expect(
      getArticleGeography(article({ title: "Slovenia election result" }))
        .subjectCountryCode,
    ).toBe("SI");

    const ecb = getArticleGeography(
      article({ title: "European Central Bank changes rates" }),
    );
    expect(ecb.subjectCountryCode).toBeNull();
    expect(ecb.region).toBe("europe");
    expect(ecb.reason).toBe("strong_title_keyword");
  });

  it("uses civic and economic context before treating Georgia or Turkey as countries", () => {
    expect(
      getArticleGeography(
        article({ title: "Georgia central bank raises rates" }),
      ).subjectCountryCode,
    ).toBe("GE");
    expect(
      getArticleGeography(
        article({ title: "Georgia-based U.S. company opens factory" }),
      ).subjectCountryCode,
    ).not.toBe("GE");
    expect(
      getArticleGeography(article({ title: "Turkey inflation rises" }))
        .subjectCountryCode,
    ).toBe("TR");
    expect(
      getArticleGeography(
        article({ title: "turkey prices rise before Thanksgiving" }),
      ).subjectCountryCode,
    ).toBeNull();
  });

  it("does not assign country geography to ambiguous company or food terms", () => {
    expect(
      getArticleGeography(article({ title: "Amazon cloud earnings rise" }))
        .subjectCountryCode,
    ).toBeNull();
    expect(
      getArticleGeography(article({ title: "Amazon cloud earnings rise" }))
        .reason,
    ).toBe("unmapped");
  });

  it("uses ticker domicile only as a low-confidence fallback", () => {
    const geography = getArticleGeography(
      article({ title: "Cloud earnings rise", tickers: ["AAPL"] }),
    );
    expect(geography.subjectCountryCode).toBe("US");
    expect(geography.companyCountryCode).toBe("US");
    expect(geography.confidence).toBe("low");
    expect(geography.reason).toBe("ticker_domicile");
    expect(geography.geographyExplanation).toContain("AAPL domicile");
  });

  it("uses a valid explicit country name when the backend code is invalid", () => {
    const geography = getArticleGeography(
      article({ country_code: "ZZ", country_name: "Slovenia" }),
    );
    expect(geography.subjectCountryCode).toBe("SI");
    expect(geography.reason).toBe("explicit_country_name");
    expect(geography.conflicts[0]?.providedValue).toBe("ZZ");
  });

  it("gives valid explicit country data precedence over title and ticker signals", () => {
    const geography = getArticleGeography(
      article({
        country_code: "DE",
        country_name: "Germany",
        title: "China expansion update",
        tickers: ["AAPL"],
      }),
    );

    expect(geography.subjectCountryCode).toBe("DE");
    expect(geography.reason).toBe("explicit_country_code");
    expect(geography.conflicts.map((conflict) => conflict.countryCode)).toEqual(
      expect.arrayContaining(["CN", "US"]),
    );
  });

  it("uses title signals before description signals, then falls back to descriptions", () => {
    const titleCountry = getArticleGeography(
      article({
        title: "China manufacturing output rises",
        description: "German exporters react",
      }),
    );
    expect(titleCountry.subjectCountryCode).toBe("CN");
    expect(titleCountry.reason).toBe("strong_title_keyword");

    const descriptionCountry = getArticleGeography(
      article({
        title: "Manufacturing output rises",
        description: "German inflation data is released",
      }),
    );
    expect(descriptionCountry.subjectCountryCode).toBe("DE");
    expect(descriptionCountry.reason).toBe("description_keyword");
  });

  it("keeps explicit regions region-only when no country is present", () => {
    const geography = getArticleGeography(
      article({ region: "Europe", title: "Rates outlook" }),
    );
    expect(geography.subjectCountryCode).toBeNull();
    expect(geography.region).toBe("europe");
    expect(geography.reason).toBe("explicit_region");
  });

  it("filters country selections by subject country instead of ticker domicile", () => {
    const chinaStory = article({
      title: "Apple expands production in China",
      tickers: ["AAPL"],
    });
    expect(
      articleMatchesSelection(chinaStory, makeCountrySelection("156", "China")),
    ).toBe(true);
    expect(
      articleMatchesSelection(
        chinaStory,
        makeCountrySelection("840", "United States of America"),
      ),
    ).toBe(false);
  });
});
