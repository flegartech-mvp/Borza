import { describe, expect, it } from "vitest";
import {
  applyFilterUpdate,
  DEFAULT_FILTERS,
  filtersToUrlSearchParams,
  parseFilterSearchParams,
} from "./filters";

describe("URL filter schema", () => {
  it("normalizes supported values", () => {
    expect(
      parseFilterSearchParams({
        search: "  chip makers  ",
        sentiment: "POSITIVE",
        ticker: "$brk.b",
        urgency: "High",
        minimum_impact: "37",
      }),
    ).toEqual({
      filters: {
        ...DEFAULT_FILTERS,
        search: "chip makers",
        sentiment: "positive",
        ticker: "BRK.B",
        urgency: "high",
        minimum_impact: "37",
      },
      issues: [],
    });
  });

  it("rejects duplicate and invalid values with actionable issues", () => {
    const result = parseFilterSearchParams({
      search: ["oil", "rates"],
      sentiment: "bullish",
      ticker: "not a ticker!",
      urgency: "urgent",
      minimum_impact: "101",
      window_hours: "999",
    });

    expect(result.filters).toEqual(DEFAULT_FILTERS);
    expect(result.issues.map((item) => item.field)).toEqual([
      "search",
      "sentiment",
      "ticker",
      "urgency",
      "minimum_impact",
      "window_hours",
    ]);
    expect(result.issues.every((item) => item.message.length > 20)).toBe(true);
  });

  it("ignores unrelated query parameters", () => {
    expect(
      parseFilterSearchParams({ campaign: "summer", sentiment: "neutral" }),
    ).toEqual({
      filters: { ...DEFAULT_FILTERS, sentiment: "neutral" },
      issues: [],
    });
  });

  it("keeps invalid client drafts out of committed filters and supports clearing and recovery", () => {
    const startingDrafts = {
      ...DEFAULT_FILTERS,
      search: "rates",
      sentiment: "positive",
      ticker: "AAPL",
    };
    const rejectedTicker = applyFilterUpdate(startingDrafts, [], {
      ...startingDrafts,
      ticker: "aapl!",
    });

    expect(rejectedTicker.filters).toEqual({
      ...startingDrafts,
      ticker: "",
    });
    expect(rejectedTicker.drafts.ticker).toBe("aapl!");
    expect(rejectedTicker.issues).toEqual([
      expect.objectContaining({
        field: "ticker",
        code: "invalid_format",
      }),
    ]);
    expect(rejectedTicker.issues[0].message).toContain(
      "Use 1–12 letters, numbers, dots, or hyphens",
    );

    const clearedTicker = applyFilterUpdate(
      rejectedTicker.drafts,
      rejectedTicker.issues,
      { ...rejectedTicker.drafts, ticker: "" },
    );
    expect(clearedTicker.filters.ticker).toBe("");
    expect(clearedTicker.drafts.ticker).toBe("");
    expect(clearedTicker.issues).toEqual([]);

    const rejectedImpact = applyFilterUpdate(
      clearedTicker.drafts,
      clearedTicker.issues,
      { ...clearedTicker.drafts, minimum_impact: "101" },
    );
    expect(rejectedImpact.filters).toMatchObject({
      search: "rates",
      sentiment: "positive",
      minimum_impact: "",
    });
    expect(rejectedImpact.drafts.minimum_impact).toBe("101");
    expect(rejectedImpact.issues[0]).toMatchObject({
      field: "minimum_impact",
      code: "invalid_format",
    });

    const recoveredImpact = applyFilterUpdate(
      rejectedImpact.drafts,
      rejectedImpact.issues,
      { ...rejectedImpact.drafts, minimum_impact: "75" },
    );
    expect(recoveredImpact.filters.minimum_impact).toBe("75");
    expect(recoveredImpact.drafts.minimum_impact).toBe("75");
    expect(recoveredImpact.issues).toEqual([]);
  });

  it("removes an invalid reserved window while preserving unrelated URL state", () => {
    const query = filtersToUrlSearchParams(
      "?campaign=summer&window_hours=999&ticker=OLD",
      { ...DEFAULT_FILTERS, sentiment: "negative", ticker: "MSFT" },
    );

    expect(query.get("campaign")).toBe("summer");
    expect(query.get("window_hours")).toBeNull();
    expect(query.get("ticker")).toBe("MSFT");
    expect(query.get("sentiment")).toBe("negative");

    const fixedWindow = filtersToUrlSearchParams(
      "?campaign=summer&window_hours=24",
      DEFAULT_FILTERS,
    );
    expect(fixedWindow.get("campaign")).toBe("summer");
    expect(fixedWindow.get("window_hours")).toBe("24");
  });
});
