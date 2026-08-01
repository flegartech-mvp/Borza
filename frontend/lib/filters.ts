export type Filters = {
  search: string;
  sentiment: string;
  ticker: string;
  urgency: string;
  minimum_impact: string;
  category: string;
  source: string;
  source_type: string;
  region: string;
  language: string;
  official_only: string;
  sort: string;
  window_hours: string;
  minimum_relevance: string;
};

export const DEFAULT_FILTERS: Filters = {
  search: "",
  sentiment: "",
  ticker: "",
  urgency: "",
  minimum_impact: "",
  category: "",
  source: "",
  source_type: "",
  region: "",
  language: "",
  official_only: "",
  sort: "newest",
  window_hours: "24",
  minimum_relevance: "",
};

export const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as Array<keyof Filters>;
export type FilterField = keyof Filters;

export type FilterIssue = {
  field: FilterField;
  code: "duplicate" | "too_long" | "invalid_choice" | "invalid_format";
  message: string;
  rejectedValues: string[];
};

export type FilterSearchParams = Record<string, string | string[] | undefined>;

const choices: Partial<Record<keyof Filters, Set<string>>> = {
  sentiment: new Set(["", "positive", "negative", "neutral"]),
  urgency: new Set(["", "breaking", "high", "medium", "low"]),
  source_type: new Set([
    "",
    "official",
    "regulator",
    "exchange",
    "editorial",
    "discovery",
    "demo",
  ]),
  region: new Set(["", "global", "europe", "north_america", "asia", "other"]),
  language: new Set(["", "en", "sl", "de", "fr", "it"]),
  official_only: new Set(["", "true"]),
  sort: new Set(["newest", "relevance", "most_covered"]),
  window_hours: new Set(["24", "48", "168"]),
};
const tickerPattern = /^[A-Z][A-Z0-9.-]{0,11}$/;
const scorePattern = /^(?:0|[1-9]\d?|100)$/;

function issue(
  field: FilterField,
  code: FilterIssue["code"],
  message: string,
  rejectedValues: string[],
): FilterIssue {
  return { field, code, message, rejectedValues };
}

function parseFilterValue(
  field: keyof Filters,
  rawValue: string,
): { value: string; issue?: FilterIssue } {
  const trimmed = rawValue.trim();

  if (["search", "source", "category"].includes(field)) {
    const limit = field === "search" ? 200 : 120;
    if (trimmed.length > limit) {
      return {
        value: DEFAULT_FILTERS[field],
        issue: issue(
          field,
          "too_long",
          `${field.replace("_", " ")} was ignored because it exceeds ${limit} characters.`,
          [rawValue],
        ),
      };
    }
    return { value: trimmed };
  }

  if (field === "ticker") {
    const normalized = trimmed.replace(/^\$/, "").toUpperCase();
    return !normalized || tickerPattern.test(normalized)
      ? { value: normalized }
      : {
          value: "",
          issue: issue(
            field,
            "invalid_format",
            "Ticker was ignored. Use 1–12 letters, numbers, dots, or hyphens, such as AAPL or BRK.B.",
            [rawValue],
          ),
        };
  }

  if (field === "minimum_impact" || field === "minimum_relevance") {
    return !trimmed || scorePattern.test(trimmed)
      ? { value: trimmed }
      : {
          value: "",
          issue: issue(
            field,
            "invalid_format",
            `${field.replace("_", " ")} was ignored. Enter a whole number from 0 to 100.`,
            [rawValue],
          ),
        };
  }

  const normalized = trimmed.toLowerCase();
  const allowed = choices[field];
  if (!allowed?.has(normalized)) {
    return {
      value: DEFAULT_FILTERS[field],
      issue: issue(
        field,
        "invalid_choice",
        `${field.replace("_", " ")} was ignored because the selected value is unsupported.`,
        [rawValue],
      ),
    };
  }
  return { value: normalized };
}

export function parseFilterSearchParams(searchParams: FilterSearchParams): {
  filters: Filters;
  issues: FilterIssue[];
} {
  const filters = { ...DEFAULT_FILTERS };
  const issues: FilterIssue[] = [];

  for (const field of FILTER_KEYS) {
    const rawValue = searchParams[field];
    if (rawValue === undefined) continue;
    if (Array.isArray(rawValue)) {
      issues.push(
        issue(
          field,
          "duplicate",
          `${field.replace("_", " ")} was ignored because it was supplied more than once.`,
          rawValue,
        ),
      );
      continue;
    }
    const parsed = parseFilterValue(field, rawValue);
    filters[field] = parsed.value;
    if (parsed.issue) issues.push(parsed.issue);
  }

  return { filters, issues };
}

export function normalizeFilters(filters: Filters): {
  filters: Filters;
  issues: FilterIssue[];
} {
  return parseFilterSearchParams(filters);
}

export function applyFilterUpdate(
  currentDrafts: Filters,
  currentIssues: FilterIssue[],
  nextDrafts: Filters,
): { filters: Filters; drafts: Filters; issues: FilterIssue[] } {
  const changedFields = FILTER_KEYS.filter(
    (field) => nextDrafts[field] !== currentDrafts[field],
  );
  const parsed = normalizeFilters(nextDrafts);
  const drafts = { ...parsed.filters };

  for (const validationIssue of parsed.issues) {
    drafts[validationIssue.field] = nextDrafts[validationIssue.field];
  }

  return {
    filters: parsed.filters,
    drafts,
    issues: [
      ...currentIssues.filter(
        (validationIssue) => !changedFields.includes(validationIssue.field),
      ),
      ...parsed.issues.filter((validationIssue) =>
        changedFields.includes(validationIssue.field),
      ),
    ],
  };
}

export function filtersToUrlSearchParams(
  currentSearch: string,
  filters: Filters,
): URLSearchParams {
  const query = new URLSearchParams(currentSearch);
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (key === "window_hours" && value === DEFAULT_FILTERS.window_hours) {
      const existing = query.getAll(key);
      if (existing.length !== 1 || existing[0] !== value) query.delete(key);
      continue;
    }
    if (value && value !== DEFAULT_FILTERS[key]) query.set(key, value);
    else query.delete(key);
  }
  return query;
}
