import { expect, test, type Page } from "@playwright/test";

const now = new Date().toISOString();

function article(id = 1, provider = "rss") {
  return {
    id,
    external_id: `${provider}-${id}`,
    provider,
    provider_article_id: String(id),
    is_demo: provider === "demo",
    title:
      id === 2
        ? "ECB update appears after refresh"
        : "ECB keeps interest rates unchanged",
    description:
      "The central bank held its benchmark rates and explained the economic context.",
    article_url: `https://publisher.example/story-${id}`,
    source: provider === "demo" ? "Borza demo" : "European Central Bank",
    source_type: provider === "demo" ? "demo" : "official",
    source_domain: "publisher.example",
    published_at: now,
    sentiment: "neutral",
    sentiment_confidence: 0.72,
    positive_probability: 0.14,
    negative_probability: 0.14,
    neutral_probability: 0.72,
    impact_score: 70,
    impact_score_base: 70,
    relevance_score: 84,
    relevance_reason: "Verified first-party financial publication",
    urgency: "medium",
    tickers: [],
    sector: "Central banks",
    region: "europe",
    language: "en",
    categories: ["central_banks"],
    organizations: ["European Central Bank"],
    companies: [],
    asset_classes: ["rates"],
    trust_score: provider === "demo" ? 0 : 100,
    duplicate_count: 2,
    duplicate_source_count: 2,
    alternative_sources: [],
    extraction_status: "provider_metadata",
    is_stale: false,
    tone_method: provider === "demo" ? "demo_tone" : "neutral_fallback",
    tone_kind: provider === "demo" ? "demo" : "fallback",
    impact_method: "editorial_attention_heuristic_v2",
  };
}

async function mockApi(
  page: Page,
  options: { unavailable?: boolean; demo?: boolean; refreshes?: boolean } = {},
) {
  let refreshed = false;
  await page.context().route("https://publisher.example/**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Publisher article</title><h1>Original article</h1>",
    });
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (options.unavailable && url.pathname.endsWith("/news-page")) {
      await route.fulfill({ status: 503, body: "temporarily unavailable" });
      return;
    }

    const empty = url.searchParams.get("search") === "no-match";
    const provider = options.demo ? "demo" : "rss";
    const current = article(options.refreshes && refreshed ? 2 : 1, provider);
    const articles = empty ? [] : [current];

    if (url.pathname.endsWith("/news-page")) {
      await route.fulfill({
        json: {
          items: articles,
          total: articles.length,
          limit: 12,
          offset: 0,
          has_more: false,
          next_cursor: null,
          window_hours: 24,
          effective_window_hours: 24,
          window_start: now,
          window_end: now,
          timestamp_field: "published_at",
          active_filters: {},
          sort: "newest",
          data_freshness: "fresh",
          most_recent_successful_ingestion: now,
          contains_demo_data: options.demo ?? false,
          partial_results: false,
        },
      });
      return;
    }
    if (url.pathname.endsWith("/analysis")) {
      await route.fulfill({
        json: {
          articles,
          total_matching: articles.length,
          sample_size: articles.length,
          sample_limit: 500,
          truncated: false,
          window_hours: 24,
          effective_window_hours: 24,
          window_start: now,
          window_end: now,
          timestamp_field: "published_at",
        },
      });
      return;
    }
    if (url.pathname.endsWith("/stats")) {
      await route.fulfill({
        json: {
          article_count: articles.length,
          article_count_24h: articles.length,
          sentiment_distribution: {
            positive: 0,
            negative: 0,
            neutral: articles.length,
          },
          average_impact: articles.length ? 70 : 0,
          top_ticker: null,
          top_tickers: [],
          window_hours: 24,
          effective_window_hours: 24,
          window_start: now,
          window_end: now,
          timestamp_field: "published_at",
          sample_size: articles.length,
          tone_scope: "Stored article-language labels",
        },
      });
      return;
    }
    if (url.pathname.endsWith("/ingestion-status")) {
      await route.fulfill({
        json: {
          status: "complete",
          provider: options.demo ? "demo" : "composite",
          worker_status: "ready",
          last_started_at: now,
          last_completed_at: now,
          last_successful_at: now,
          records_inserted: articles.length,
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        latest_published_at: now,
        article_count: articles.length,
        revision: "1",
      },
    });
  });

  return {
    markRefreshed() {
      refreshed = true;
    },
  };
}

test("opens the news workspace and shows normalized news", async ({ page }) => {
  await mockApi(page);
  await page.goto("/news");
  await expect(
    page.getByRole("heading", { name: "News Explorer", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("ECB keeps interest rates unchanged"),
  ).toBeVisible();
  await expect(
    page.getByText("official", { exact: false }).first(),
  ).toBeVisible();
});

test("searches, filters, and handles an empty result", async ({ page }) => {
  await mockApi(page);
  await page.goto("/news");
  await page.getByRole("searchbox", { name: "Search" }).fill("rates");
  await expect(page).toHaveURL(/search=rates/);
  await page.getByLabel("Region").selectOption("europe");
  await expect(page).toHaveURL(/region=europe/);
  await page.getByRole("searchbox", { name: "Search" }).fill("no-match");
  await expect(page.getByText(/No stories match Global/)).toBeVisible();
});

test("opens the original publisher article", async ({ page }) => {
  await mockApi(page);
  await page.goto("/news");
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: /Open source/ })
    .first()
    .click();
  const popup = await popupPromise;
  expect(popup.url()).toContain("publisher.example/story-1");
});

test("shows an explicit fallback when the API is unavailable", async ({
  page,
}) => {
  await mockApi(page, { unavailable: true });
  await page.goto("/news");
  await expect(page.getByText("Simulated fallback stories")).toBeVisible();
  await expect(page.getByText(/not live reports/)).toBeVisible();
});

test("labels provider demo content", async ({ page }) => {
  await mockApi(page, { demo: true });
  await page.goto("/news");
  await expect(
    page.getByText("Demo data", { exact: true }).first(),
  ).toBeVisible();
});

test("refreshes the overview with newly available data", async ({ page }) => {
  const api = await mockApi(page, { refreshes: true });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "ECB keeps interest rates unchanged",
      level: 4,
    }),
  ).toBeVisible();
  api.markRefreshed();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(
    page.getByRole("heading", {
      name: "ECB update appears after refresh",
      level: 4,
    }),
  ).toBeVisible();
});

test("keeps navigation and filters usable on a phone", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "mobile project only");
  await mockApi(page);
  await page.goto("/news");
  await expect(
    page.getByRole("navigation", { name: "Mobile primary navigation" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
