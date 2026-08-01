import type { Article, Stats } from "./types";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const UI_DEMO_ARTICLES: Article[] = [
  {
    id: -1,
    external_id: "ui-demo-us",
    title: "Demo: US technology companies lead today’s sample coverage",
    description:
      "A sample story used only when the Borza API is unavailable, so the map interaction can still be reviewed.",
    article_url: "",
    source: "Borza demo",
    published_at: minutesAgo(12),
    sentiment: "positive",
    sentiment_confidence: 0.81,
    positive_probability: 0.81,
    negative_probability: 0.06,
    neutral_probability: 0.13,
    impact_score: 78,
    urgency: "high",
    tickers: ["NVDA", "MSFT"],
    tone_method: "demo_tone",
    tone_kind: "demo",
    impact_method: "editorial_attention_heuristic_v2",
    sector: "Technology",
    country_code: "US",
    country_name: "United States",
    region: "North America",
  },
  {
    id: -2,
    external_id: "ui-demo-de",
    title: "Demo: European software outlook remains mixed",
    description:
      "This illustrative headline provides regional variety for the offline interface preview.",
    article_url: "",
    source: "Borza demo",
    published_at: minutesAgo(31),
    sentiment: "neutral",
    sentiment_confidence: 0.72,
    positive_probability: 0.17,
    negative_probability: 0.11,
    neutral_probability: 0.72,
    impact_score: 61,
    urgency: "medium",
    tickers: ["SAP"],
    tone_method: "demo_tone",
    tone_kind: "demo",
    impact_method: "editorial_attention_heuristic_v2",
    sector: "Technology",
    country_code: "DE",
    country_name: "Germany",
    region: "Europe",
  },
  {
    id: -3,
    external_id: "ui-demo-tw",
    title: "Demo: Taiwan chip supply update draws investor attention",
    description:
      "This is simulated interface content, not a live market report or an investment signal.",
    article_url: "",
    source: "Borza demo",
    published_at: minutesAgo(49),
    sentiment: "positive",
    sentiment_confidence: 0.76,
    positive_probability: 0.76,
    negative_probability: 0.08,
    neutral_probability: 0.16,
    impact_score: 74,
    urgency: "medium",
    tickers: ["TSM"],
    tone_method: "demo_tone",
    tone_kind: "demo",
    impact_method: "editorial_attention_heuristic_v2",
    sector: "Technology",
    country_code: "TW",
    country_name: "Taiwan",
    region: "Asia Pacific",
  },
  {
    id: -4,
    external_id: "ui-demo-br",
    title: "Demo: Brazilian energy producers review capital plans",
    description:
      "A clearly labeled sample used to demonstrate country filtering while the API is offline.",
    article_url: "",
    source: "Borza demo",
    published_at: minutesAgo(67),
    sentiment: "neutral",
    sentiment_confidence: 0.69,
    positive_probability: 0.19,
    negative_probability: 0.12,
    neutral_probability: 0.69,
    impact_score: 55,
    urgency: "low",
    tickers: ["PBR"],
    tone_method: "demo_tone",
    tone_kind: "demo",
    impact_method: "editorial_attention_heuristic_v2",
    sector: "Energy",
    country_code: "BR",
    country_name: "Brazil",
    region: "Latin America",
  },
  {
    id: -5,
    external_id: "ui-demo-za",
    title: "Demo: South African banks face a cautious lending backdrop",
    description:
      "Sample data keeps the geographic empty and selected states visible during local frontend work.",
    article_url: "",
    source: "Borza demo",
    published_at: minutesAgo(82),
    sentiment: "negative",
    sentiment_confidence: 0.73,
    positive_probability: 0.09,
    negative_probability: 0.73,
    neutral_probability: 0.18,
    impact_score: 58,
    urgency: "medium",
    tickers: [],
    tone_method: "demo_tone",
    tone_kind: "demo",
    impact_method: "editorial_attention_heuristic_v2",
    sector: "Banking",
    country_code: "ZA",
    country_name: "South Africa",
    region: "Middle East and Africa",
  },
];

export function statsFromArticles(articles: Article[]): Stats {
  const tickerCounts = new Map<string, number>();
  const sentimentDistribution = { positive: 0, negative: 0, neutral: 0 };

  for (const article of articles) {
    sentimentDistribution[article.sentiment] += 1;
    for (const ticker of article.tickers) {
      tickerCounts.set(ticker, (tickerCounts.get(ticker) ?? 0) + 1);
    }
  }

  const topTickers = [...tickerCounts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5)
    .map(([ticker, count]) => ({ ticker, count }));

  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return {
    article_count: articles.length,
    article_count_24h: articles.length,
    sentiment_distribution: sentimentDistribution,
    average_impact: articles.length
      ? articles.reduce((total, article) => total + article.impact_score, 0) /
        articles.length
      : 0,
    top_ticker: topTickers[0]?.ticker ?? null,
    top_tickers: topTickers,
    window_hours: 24,
    effective_window_hours: 24,
    window_start: windowStart,
    window_end: windowEnd,
    timestamp_field: "published_at",
    sample_size: articles.length,
    tone_scope: "Simulated article tone labels",
  };
}
