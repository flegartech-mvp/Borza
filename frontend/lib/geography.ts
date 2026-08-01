import {
  getCountryByAlpha2,
  getCountryByAtlasName,
  getCountryByName,
  getCountryRegion,
  type CountryMetadata,
  type CountryRegion,
} from "./country-metadata";
import type { Article, Sentiment } from "./types";

export type RegionId = CountryRegion;
export type GeographyConfidence =
  "explicit" | "high" | "medium" | "low" | "none";
export type GeographyReason =
  | "explicit_country_code"
  | "explicit_country_name"
  | "explicit_region"
  | "strong_title_keyword"
  | "description_keyword"
  | "source_mapping"
  | "ticker_domicile"
  | "unmapped";

export type GeographyConflict = {
  reason: GeographyReason;
  countryCode: string | null;
  countryName: string | null;
  region: RegionId | null;
  providedValue?: string;
};

export type GeographySelection =
  | { kind: "global"; id: "global"; label: "Global"; region: "global" }
  | { kind: "region"; id: RegionId; label: string; region: RegionId }
  | {
      kind: "country";
      id: string;
      label: string;
      countryName: string;
      countryCode: string | null;
      region: RegionId;
    };

export type ArticleGeography = {
  subjectCountryCode: string | null;
  subjectCountryName: string | null;
  atlasCountryName: string | null;
  companyCountryCode: string | null;
  companyCountryName: string | null;
  sourceCountryCode: string | null;
  sourceCountryName: string | null;
  region: RegionId | null;
  confidence: GeographyConfidence;
  reason: GeographyReason;
  isInferred: boolean;
  geographyExplanation: string;
  conflicts: readonly GeographyConflict[];
};

type GeographyCandidate = {
  country: CountryMetadata | null;
  region: RegionId | null;
  reason: GeographyReason;
  confidence: GeographyConfidence;
  label: string;
};

type KeywordSignal = {
  countryCode: string;
  label: string;
  patterns: readonly RegExp[];
};

type RegionSignal = {
  region: RegionId;
  label: string;
  patterns: readonly RegExp[];
};

export const GLOBAL_SELECTION: GeographySelection = {
  kind: "global",
  id: "global",
  label: "Global",
  region: "global",
};

export const REGION_OPTIONS: ReadonlyArray<{
  id: RegionId;
  label: string;
  shortLabel?: string;
}> = [
  { id: "global", label: "Global" },
  { id: "north-america", label: "North America" },
  { id: "latin-america", label: "Latin America" },
  { id: "europe", label: "Europe" },
  { id: "middle-east", label: "Middle East" },
  { id: "africa", label: "Africa" },
  { id: "asia", label: "Asia" },
  { id: "oceania", label: "Oceania" },
];

const TICKER_COUNTRY: Record<string, string> = {
  AAPL: "US",
  AMD: "US",
  AMZN: "US",
  COIN: "US",
  CVX: "US",
  GOOGL: "US",
  INTC: "US",
  JPM: "US",
  META: "US",
  MRNA: "US",
  MSFT: "US",
  NFLX: "US",
  NVDA: "US",
  TSLA: "US",
  ASML: "NL",
  SAP: "DE",
  BMW: "DE",
  SHEL: "GB",
  BP: "GB",
  AZN: "GB",
  TSM: "TW",
  BABA: "CN",
  JD: "CN",
  BIDU: "CN",
  NIO: "CN",
  TM: "JP",
  SONY: "JP",
  SHOP: "CA",
  RY: "CA",
  TD: "CA",
  UBS: "CH",
  NVO: "DK",
  SPOT: "SE",
  INFY: "IN",
  HDB: "IN",
  VALE: "BR",
  PBR: "BR",
  MELI: "AR",
  BHP: "AU",
};

// These terms are intentionally conservative. Ambiguous names require financial or civic context.
const COUNTRY_KEYWORDS: readonly KeywordSignal[] = [
  {
    countryCode: "US",
    label: "the United States",
    patterns: [
      /\bunited states(?: of america)?\b/,
      /\bus\b/,
      /\busa\b/,
      /\bu s(?: a)?\b/,
      /\bamerican\b/,
      /\bfederal reserve\b/,
      /\bfed\b/,
      /\bwall street\b/,
    ],
  },
  {
    countryCode: "CN",
    label: "China",
    patterns: [/\bchina\b/, /\bchinese\b/, /\bbeijing\b/],
  },
  {
    countryCode: "DE",
    label: "Germany",
    patterns: [/\bgermany\b/, /\bgerman\b/, /\bbundesbank\b/],
  },
  {
    countryCode: "SI",
    label: "Slovenia",
    patterns: [/\bslovenia\b/, /\bslovenian\b/],
  },
  {
    countryCode: "HR",
    label: "Croatia",
    patterns: [/\bcroatia\b/, /\bcroatian\b/],
  },
  {
    countryCode: "GB",
    label: "the United Kingdom",
    patterns: [
      /\bunited kingdom\b/,
      /\bbritain\b/,
      /\bbritish\b/,
      /\bbank of england\b/,
    ],
  },
  {
    countryCode: "FR",
    label: "France",
    patterns: [/\bfrance\b/, /\bfrench\b/, /\bbank of france\b/],
  },
  {
    countryCode: "CA",
    label: "Canada",
    patterns: [/\bcanada\b/, /\bcanadian\b/, /\bbank of canada\b/],
  },
  {
    countryCode: "JP",
    label: "Japan",
    patterns: [/\bjapan\b/, /\bjapanese\b/, /\bbank of japan\b/, /\btokyo\b/],
  },
  {
    countryCode: "IN",
    label: "India",
    patterns: [/\bindia\b/, /\bindian\b/, /\breserve bank of india\b/],
  },
  {
    countryCode: "KR",
    label: "South Korea",
    patterns: [/\bsouth korea\b/, /\bkorean\b/, /\bseoul\b/],
  },
  {
    countryCode: "TW",
    label: "Taiwan",
    patterns: [/\btaiwan\b/, /\btaiwanese\b/, /\btaipei\b/],
  },
  {
    countryCode: "BR",
    label: "Brazil",
    patterns: [/\bbrazil\b/, /\bbrazilian\b/, /\bbanco central do brasil\b/],
  },
  {
    countryCode: "AU",
    label: "Australia",
    patterns: [
      /\baustralia\b/,
      /\baustralian\b/,
      /\breserve bank of australia\b/,
    ],
  },
  {
    countryCode: "MX",
    label: "Mexico",
    patterns: [/\bmexico\b/, /\bmexican\b/],
  },
  {
    countryCode: "AE",
    label: "the United Arab Emirates",
    patterns: [/\bunited arab emirates\b/, /\buae\b/, /\bdubai\b/],
  },
  {
    countryCode: "NG",
    label: "Nigeria",
    patterns: [/\bnigeria\b/, /\bnigerian\b/, /\blagos\b/],
  },
  {
    countryCode: "GE",
    label: "Georgia",
    patterns: [
      /\bgeorgian\b/,
      /\btbilisi\b/,
      /\blari\b/,
      /\bgeorgia\b(?=\s+(?:central bank|election|government|parliament|economy|inflation|rates))/,
    ],
  },
  {
    countryCode: "TR",
    label: "Türkiye",
    patterns: [
      /\bturkiye\b/,
      /\bturkey\b(?=\s+(?:annual\s+)?(?:inflation|central bank|lira|economy|rates|election|exports))/,
    ],
  },
  {
    countryCode: "JO",
    label: "Jordan",
    patterns: [
      /\bjordanian\b/,
      /\bamman\b/,
      /\bcentral bank of jordan\b/,
      /\bkingdom of jordan\b/,
    ],
  },
];

const REGION_KEYWORDS: readonly RegionSignal[] = [
  {
    region: "europe",
    label: "Europe",
    patterns: [/\beuropean central bank\b/, /\beurozone\b/, /\beurope\b/],
  },
  {
    region: "north-america",
    label: "North America",
    patterns: [/\bnorth america\b/],
  },
  {
    region: "latin-america",
    label: "Latin America",
    patterns: [/\blatin america\b/, /\bsouth america\b/],
  },
  {
    region: "asia",
    label: "Asia",
    patterns: [/\basia pacific\b/, /\bapac\b/, /\basia\b/],
  },
  {
    region: "oceania",
    label: "Oceania",
    patterns: [/\boceania\b/, /\bsouth pacific\b/],
  },
  {
    region: "middle-east",
    label: "Middle East",
    patterns: [/\bmiddle east\b/, /\bmena\b/],
  },
  {
    region: "africa",
    label: "Africa",
    patterns: [/\bsub saharan africa\b/, /\bafrica\b/],
  },
];

// A source location is used only for publications whose coverage is explicitly country-specific.
const RELIABLE_SOURCE_COUNTRIES: Readonly<Record<string, string>> = {
  "china daily": "CN",
  "the times of india": "IN",
  "the korea herald": "KR",
  "the straits times": "SG",
  "the jerusalem post": "IL",
};

function normalizeArticleText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRegion(value?: string | null): RegionId | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/&/g, "and");
  if (normalized.includes("north-america")) return "north-america";
  if (normalized.includes("latin") || normalized.includes("south-america"))
    return "latin-america";
  if (normalized.includes("europe")) return "europe";
  if (normalized.includes("middle-east") || normalized.includes("mena"))
    return "middle-east";
  if (normalized.includes("africa")) return "africa";
  if (normalized.includes("oceania")) return "oceania";
  if (normalized.includes("asia") || normalized.includes("pacific"))
    return "asia";
  if (normalized.includes("global")) return "global";
  return null;
}

function firstCountrySignal(text: string): CountryMetadata | null {
  const normalized = normalizeArticleText(text);
  let match: { country: CountryMetadata; index: number } | null = null;
  for (const signal of COUNTRY_KEYWORDS) {
    const country = getCountryByAlpha2(signal.countryCode);
    if (!country) continue;
    for (const pattern of signal.patterns) {
      const current = normalized.match(pattern);
      if (
        current?.index !== undefined &&
        (!match || current.index < match.index)
      ) {
        match = { country, index: current.index };
      }
    }
  }
  return match?.country ?? null;
}

function firstRegionSignal(text: string): RegionId | null {
  const normalized = normalizeArticleText(text);
  let match: { region: RegionId; index: number } | null = null;
  for (const signal of REGION_KEYWORDS) {
    for (const pattern of signal.patterns) {
      const current = normalized.match(pattern);
      if (
        current?.index !== undefined &&
        (!match || current.index < match.index)
      ) {
        match = { region: signal.region, index: current.index };
      }
    }
  }
  return match?.region ?? null;
}

function lowerConfidence(confidence: GeographyConfidence): GeographyConfidence {
  if (confidence === "explicit") return "high";
  if (confidence === "high") return "medium";
  if (confidence === "medium") return "low";
  return confidence;
}

function regionLabel(region: RegionId): string {
  return (
    REGION_OPTIONS.find((option) => option.id === region)?.label ?? "Global"
  );
}

function candidateForCountry(
  country: CountryMetadata | null,
  reason: GeographyReason,
  confidence: GeographyConfidence,
  label: string,
): GeographyCandidate | null {
  return country
    ? { country, region: country.region, reason, confidence, label }
    : null;
}

function candidateForRegion(
  region: RegionId | null,
  reason: GeographyReason,
  confidence: GeographyConfidence,
  label: string,
): GeographyCandidate | null {
  return region ? { country: null, region, reason, confidence, label } : null;
}

function companyCountry(article: Article): CountryMetadata | null {
  const tickerCode = article.tickers
    .map((ticker) => TICKER_COUNTRY[ticker.toUpperCase()])
    .find(Boolean);
  return getCountryByAlpha2(tickerCode);
}

function sourceCountry(article: Article): CountryMetadata | null {
  return getCountryByAlpha2(
    RELIABLE_SOURCE_COUNTRIES[normalizeArticleText(article.source)],
  );
}

function candidateExplanation(
  candidate: GeographyCandidate,
  ticker: string | undefined,
): string {
  if (candidate.reason === "explicit_country_code") {
    return `Mapped to ${candidate.country?.name} using the explicit backend country code.`;
  }
  if (candidate.reason === "explicit_country_name") {
    return `Mapped to ${candidate.country?.name} using the explicit backend country name.`;
  }
  if (candidate.reason === "strong_title_keyword") {
    return candidate.country
      ? `Mapped to ${candidate.country.name} because the title explicitly mentions ${candidate.label}.`
      : `Mapped to ${regionLabel(candidate.region ?? "global")} because the title explicitly mentions the region.`;
  }
  if (candidate.reason === "description_keyword") {
    return candidate.country
      ? `Mapped to ${candidate.country.name} because the description mentions ${candidate.label}.`
      : `Mapped to ${regionLabel(candidate.region ?? "global")} because the description mentions the region.`;
  }
  if (candidate.reason === "explicit_region")
    return `Region-only article: ${regionLabel(candidate.region ?? "global")}.`;
  if (candidate.reason === "source_mapping") {
    return `Mapped to ${candidate.country?.name} using a country-specific source mapping.`;
  }
  if (candidate.reason === "ticker_domicile") {
    return `Mapped to ${candidate.country?.name} using ${ticker ?? "the referenced ticker"} domicile because no subject country was detected.`;
  }
  return "No subject country or region could be mapped.";
}

export function getRegionForAtlasCountry(countryName: string): RegionId {
  return getCountryRegion(countryName) ?? "global";
}

export function getCountryProfileByAtlasName(countryName: string) {
  const country = getCountryByAtlasName(countryName);
  return country
    ? ([
        country.alpha2,
        {
          name: country.name,
          atlasName: country.atlasName,
          numericId: country.numericCode,
          region: country.region,
        },
      ] as const)
    : undefined;
}

export function getArticleGeography(article: Article): ArticleGeography {
  const explicitCode = getCountryByAlpha2(article.country_code);
  const explicitName = getCountryByName(article.country_name);
  const titleCountry = firstCountrySignal(article.title);
  const titleRegion = firstRegionSignal(article.title);
  const descriptionCountry = firstCountrySignal(article.description);
  const descriptionRegion = firstRegionSignal(article.description);
  const explicitRegion = normalizeRegion(article.region);
  const source = sourceCountry(article);
  const company = companyCountry(article);
  const ticker = article.tickers.find(
    (value) => TICKER_COUNTRY[value.toUpperCase()],
  );

  const candidates = [
    candidateForCountry(
      explicitCode,
      "explicit_country_code",
      "explicit",
      explicitCode?.name ?? "",
    ),
    candidateForCountry(
      explicitName,
      "explicit_country_name",
      "explicit",
      explicitName?.name ?? "",
    ),
    candidateForCountry(
      titleCountry,
      "strong_title_keyword",
      "high",
      titleCountry?.name ?? "",
    ),
    candidateForRegion(
      titleRegion,
      "strong_title_keyword",
      "high",
      regionLabel(titleRegion ?? "global"),
    ),
    candidateForCountry(
      descriptionCountry,
      "description_keyword",
      "medium",
      descriptionCountry?.name ?? "",
    ),
    candidateForRegion(
      descriptionRegion,
      "description_keyword",
      "medium",
      regionLabel(descriptionRegion ?? "global"),
    ),
    candidateForRegion(
      explicitRegion,
      "explicit_region",
      "explicit",
      regionLabel(explicitRegion ?? "global"),
    ),
    candidateForCountry(source, "source_mapping", "low", source?.name ?? ""),
    candidateForCountry(company, "ticker_domicile", "low", company?.name ?? ""),
  ].filter((candidate): candidate is GeographyCandidate => candidate !== null);

  const selected = candidates[0] ?? {
    country: null,
    region: null,
    reason: "unmapped" as const,
    confidence: "none" as const,
    label: "",
  };
  const selectedRegion = selected.country?.region ?? selected.region;
  const conflicts: GeographyConflict[] = [];

  if (article.country_code?.trim() && !explicitCode) {
    conflicts.push({
      reason: "explicit_country_code",
      countryCode: null,
      countryName: null,
      region: null,
      providedValue: article.country_code.trim(),
    });
  }

  for (const candidate of candidates.slice(1)) {
    const candidateRegion = candidate.country?.region ?? candidate.region;
    const differentCountry =
      selected.country !== null &&
      candidate.country !== null &&
      selected.country.alpha2 !== candidate.country.alpha2;
    const differentRegion =
      selectedRegion !== null &&
      candidateRegion !== null &&
      selectedRegion !== candidateRegion;
    if (differentCountry || differentRegion) {
      conflicts.push({
        reason: candidate.reason,
        countryCode: candidate.country?.alpha2 ?? null,
        countryName: candidate.country?.name ?? null,
        region: candidateRegion,
      });
    }
  }

  const confidence = conflicts.length
    ? lowerConfidence(selected.confidence)
    : selected.confidence;
  const conflictSummary = conflicts.length
    ? ` Conflicting geography signals retained (${conflicts
        .map(
          (conflict) =>
            conflict.countryName ??
            conflict.providedValue ??
            regionLabel(conflict.region ?? "global"),
        )
        .join(", ")}).`
    : "";

  return {
    subjectCountryCode: selected.country?.alpha2 ?? null,
    subjectCountryName: selected.country?.name ?? null,
    atlasCountryName: selected.country?.atlasName ?? null,
    companyCountryCode: company?.alpha2 ?? null,
    companyCountryName: company?.name ?? null,
    sourceCountryCode: source?.alpha2 ?? null,
    sourceCountryName: source?.name ?? null,
    region: selectedRegion,
    confidence,
    reason: selected.reason,
    isInferred: ![
      "explicit_country_code",
      "explicit_country_name",
      "explicit_region",
      "unmapped",
    ].includes(selected.reason),
    geographyExplanation: `${candidateExplanation(selected, ticker)}${conflictSummary}`,
    conflicts,
  };
}

export function makeRegionSelection(region: RegionId): GeographySelection {
  if (region === "global") return GLOBAL_SELECTION;
  const label =
    REGION_OPTIONS.find((option) => option.id === region)?.label ?? "Global";
  return { kind: "region", id: region, label, region };
}

export function makeCountrySelection(
  numericId: string,
  countryName: string,
): GeographySelection {
  const profileEntry = getCountryProfileByAtlasName(countryName);
  return {
    kind: "country",
    id: numericId,
    label: profileEntry?.[1].name ?? countryName,
    countryName,
    countryCode: profileEntry?.[0] ?? null,
    region: profileEntry?.[1].region ?? getRegionForAtlasCountry(countryName),
  };
}

export function articleMatchesSelection(
  article: Article,
  selection: GeographySelection,
): boolean {
  if (selection.kind === "global") return true;
  const geography = getArticleGeography(article);
  if (selection.kind === "region") return geography.region === selection.region;
  return (
    (selection.countryCode !== null &&
      geography.subjectCountryCode === selection.countryCode) ||
    geography.atlasCountryName === selection.countryName
  );
}

export function dominantSentiment(articles: Article[]): Sentiment {
  const counts: Record<Sentiment, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  for (const article of articles) counts[article.sentiment] += 1;
  return (
    (Object.entries(counts) as Array<[Sentiment, number]>).sort(
      (first, second) => second[1] - first[1],
    )[0]?.[0] ?? "neutral"
  );
}
