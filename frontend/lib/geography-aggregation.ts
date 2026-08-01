import {
  dominantSentiment,
  getArticleGeography,
  type RegionId,
} from "./geography";
import { isCountryRepresentedOnAtlas } from "./country-metadata";
import type { Article, Sentiment } from "./types";

export type GeographyAggregation = {
  totalArticles: number;
  mappedCountryArticles: number;
  regionOnlyArticles: number;
  unmappedArticles: number;
  articlesByCountryCode: ReadonlyMap<string, readonly Article[]>;
  articlesByRegion: ReadonlyMap<RegionId, readonly Article[]>;
  countryArticleCounts: ReadonlyMap<string, number>;
  dominantSentimentByCountry: ReadonlyMap<string, Sentiment>;
  averageImpactByCountry: ReadonlyMap<string, number>;
  inferredCountryArticleCounts: ReadonlyMap<string, number>;
};

function appendToMap<Key>(
  map: Map<Key, Article[]>,
  key: Key,
  article: Article,
): void {
  const current = map.get(key);
  if (current) current.push(article);
  else map.set(key, [article]);
}

/**
 * Aggregates subject geography only. A mapped story has a subject country with a
 * corresponding world-atlas feature; region-only and unmapped stories never inflate map totals.
 */
export function aggregateArticlesByGeography(
  articles: readonly Article[],
): GeographyAggregation {
  const articlesByCountryCode = new Map<string, Article[]>();
  const articlesByRegion = new Map<RegionId, Article[]>();
  const inferredCountryArticleCounts = new Map<string, number>();
  let mappedCountryArticles = 0;
  let regionOnlyArticles = 0;
  let unmappedArticles = 0;

  for (const article of articles) {
    const geography = getArticleGeography(article);
    const countryCode = geography.subjectCountryCode;
    const mappedCountry =
      countryCode !== null && isCountryRepresentedOnAtlas(countryCode);

    if (geography.region && geography.region !== "global") {
      appendToMap(articlesByRegion, geography.region, article);
    }

    if (mappedCountry && countryCode) {
      mappedCountryArticles += 1;
      appendToMap(articlesByCountryCode, countryCode, article);
      if (geography.isInferred) {
        inferredCountryArticleCounts.set(
          countryCode,
          (inferredCountryArticleCounts.get(countryCode) ?? 0) + 1,
        );
      }
    } else if (
      countryCode === null &&
      geography.region &&
      geography.region !== "global"
    ) {
      regionOnlyArticles += 1;
    } else {
      unmappedArticles += 1;
    }
  }

  const countryArticleCounts = new Map<string, number>();
  const dominantSentimentByCountry = new Map<string, Sentiment>();
  const averageImpactByCountry = new Map<string, number>();
  for (const [countryCode, countryArticles] of articlesByCountryCode) {
    countryArticleCounts.set(countryCode, countryArticles.length);
    dominantSentimentByCountry.set(
      countryCode,
      dominantSentiment(countryArticles),
    );
    averageImpactByCountry.set(
      countryCode,
      countryArticles.reduce(
        (total, article) => total + article.impact_score,
        0,
      ) / countryArticles.length,
    );
  }

  return {
    totalArticles: articles.length,
    mappedCountryArticles,
    regionOnlyArticles,
    unmappedArticles,
    articlesByCountryCode,
    articlesByRegion,
    countryArticleCounts,
    dominantSentimentByCountry,
    averageImpactByCountry,
    inferredCountryArticleCounts,
  };
}
