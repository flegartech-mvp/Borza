import {
  ATLAS_COUNTRY_CODES,
  COMPACT_COUNTRY_METADATA,
  type CompactCountryMetadata,
  type CompactCountryRegion,
} from "./country-metadata-data";

export type CountryRegion = CompactCountryRegion;
export type CountryMetadata = CompactCountryMetadata;

const ATLAS_NAME_ALIASES: Readonly<Record<string, string>> = {
  "United States of America": "US",
  "Dominican Rep.": "DO",
  "Bosnia and Herz.": "BA",
  "Central African Rep.": "CF",
  "Dem. Rep. Congo": "CD",
  "Eq. Guinea": "GQ",
  "Falkland Is.": "FK",
  "Fr. S. Antarctic Lands": "TF",
  "N. Cyprus": "CY",
  "S. Sudan": "SS",
  "Solomon Is.": "SB",
  "W. Sahara": "EH",
};

function normalizeLookupValue(value?: string | null): string {
  return (value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const COUNTRY_METADATA: readonly CountryMetadata[] =
  COMPACT_COUNTRY_METADATA;

export const SUPPORTED_COUNTRY_COUNT = COUNTRY_METADATA.length;

const countriesByAlpha2 = new Map(
  COUNTRY_METADATA.map((country) => [country.alpha2, country]),
);
const countriesByCode = new Map<string, CountryMetadata>();
const countriesByName = new Map<string, CountryMetadata>();
const countriesByAtlasName = new Map<string, CountryMetadata>();

for (const country of COUNTRY_METADATA) {
  countriesByCode.set(country.alpha2, country);
  countriesByCode.set(country.alpha3, country);
  if (country.numericCode) countriesByCode.set(country.numericCode, country);
  for (const alias of country.aliases) {
    const normalized = normalizeLookupValue(alias);
    if (normalized && !countriesByName.has(normalized))
      countriesByName.set(normalized, country);
  }
  countriesByAtlasName.set(normalizeLookupValue(country.atlasName), country);
}

for (const [atlasName, alpha2] of Object.entries(ATLAS_NAME_ALIASES)) {
  const country = countriesByAlpha2.get(alpha2);
  if (country)
    countriesByAtlasName.set(normalizeLookupValue(atlasName), country);
}

const atlasCountryCodes = new Set<string>(ATLAS_COUNTRY_CODES);

export function normalizeCountryCode(value?: string | null): string | null {
  const normalized = normalizeLookupValue(value)
    .replace(/\s/g, "")
    .toUpperCase();
  if (!normalized) return null;
  return countriesByCode.get(normalized)?.alpha2 ?? null;
}

export function normalizeCountryName(value?: string | null): string | null {
  return normalizeLookupValue(value) || null;
}

export function getCountryByAlpha2(
  value?: string | null,
): CountryMetadata | null {
  const alpha2 = normalizeCountryCode(value);
  return alpha2 ? (countriesByAlpha2.get(alpha2) ?? null) : null;
}

export function getCountryByName(
  value?: string | null,
): CountryMetadata | null {
  const byCode = getCountryByAlpha2(value);
  if (byCode) return byCode;
  const normalized = normalizeCountryName(value);
  return normalized ? (countriesByName.get(normalized) ?? null) : null;
}

export function getCountryByAtlasName(
  value?: string | null,
): CountryMetadata | null {
  const normalized = normalizeCountryName(value);
  if (!normalized) return null;
  return countriesByAtlasName.get(normalized) ?? getCountryByName(value);
}

export function getAtlasCountryName(value?: string | null): string | null {
  return (
    (getCountryByAlpha2(value) ?? getCountryByName(value))?.atlasName ?? null
  );
}

export function getCountryRegion(value?: string | null): CountryRegion | null {
  return (
    getCountryByAlpha2(value)?.region ??
    getCountryByName(value)?.region ??
    getCountryByAtlasName(value)?.region ??
    null
  );
}

export function isCountryRepresentedOnAtlas(value?: string | null): boolean {
  return atlasCountryCodes.has(getCountryByAlpha2(value)?.alpha2 ?? "");
}
