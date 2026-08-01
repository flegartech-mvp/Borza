export type Filters = {
  search: string;
  sentiment: string;
  ticker: string;
  urgency: string;
  minimum_impact: string;
};

export const DEFAULT_FILTERS: Filters = {
  search: "",
  sentiment: "",
  ticker: "",
  urgency: "",
  minimum_impact: "",
};

export const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as Array<keyof Filters>;

export const FIXED_WINDOW_HOURS_PARAM = "24";

export type FilterField = keyof Filters | "window_hours";

export type FilterIssue = {
  field: FilterField;
  code: "duplicate" | "too_long" | "invalid_choice" | "invalid_format";
  message: string;
  rejectedValues: string[];
};

export type FilterSearchParams = Record<string, string | string[] | undefined>;

const sentimentValues = new Set(["", "positive", "negative", "neutral"]);
const urgencyValues = new Set(["", "breaking", "high", "medium", "low"]);
const tickerPattern = /^[A-Z][A-Z0-9.-]{0,11}$/;
const impactPattern = /^(?:0|[1-9]\d?|100)$/;

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

  if (field === "search") {
    if (trimmed.length > 200) {
      return {
        value: "",
        issue: issue(
          field,
          "too_long",
          "Search was ignored because it exceeds 200 characters. Shorten the search and try again.",
          [rawValue],
        ),
      };
    }
    return { value: trimmed };
  }

  if (field === "sentiment") {
    const normalized = trimmed.toLowerCase();
    return sentimentValues.has(normalized)
      ? { value: normalized }
      : {
          value: "",
          issue: issue(
            field,
            "invalid_choice",
            'Article tone was ignored. Choose "positive", "negative", "neutral", or all tones.',
            [rawValue],
          ),
        };
  }

  if (field === "urgency") {
    const normalized = trimmed.toLowerCase();
    return urgencyValues.has(normalized)
      ? { value: normalized }
      : {
          value: "",
          issue: issue(
            field,
            "invalid_choice",
            'Urgency was ignored. Choose "breaking", "high", "medium", "low", or all urgency levels.',
            [rawValue],
          ),
        };
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

  return !trimmed || impactPattern.test(trimmed)
    ? { value: trimmed }
    : {
        value: "",
        issue: issue(
          field,
          "invalid_format",
          "Minimum base attention was ignored. Enter a whole number from 0 to 100.",
          [rawValue],
        ),
      };
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
          `${field.replace("_", " ")} was ignored because it was supplied more than once. Keep one value and try again.`,
          rawValue,
        ),
      );
      continue;
    }
    const parsed = parseFilterValue(field, rawValue);
    filters[field] = parsed.value;
    if (parsed.issue) issues.push(parsed.issue);
  }

  const rawWindow = searchParams.window_hours;
  if (Array.isArray(rawWindow)) {
    issues.push(
      issue(
        "window_hours",
        "duplicate",
        "Analysis window was removed because it was supplied more than once. Borza uses a fixed rolling 24-hour window.",
        rawWindow,
      ),
    );
  } else if (
    rawWindow !== undefined &&
    rawWindow.trim() !== FIXED_WINDOW_HOURS_PARAM
  ) {
    issues.push(
      issue(
        "window_hours",
        "invalid_format",
        "Analysis window was removed. Borza uses a fixed rolling 24-hour window.",
        [rawWindow],
      ),
    );
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
): {
  filters: Filters;
  drafts: Filters;
  issues: FilterIssue[];
} {
  const changedFields = FILTER_KEYS.filter(
    (field) => nextDrafts[field] !== currentDrafts[field],
  );
  const parsed = normalizeFilters(nextDrafts);
  const drafts = { ...parsed.filters };

  for (const validationIssue of parsed.issues) {
    if (validationIssue.field === "window_hours") continue;
    drafts[validationIssue.field] = nextDrafts[validationIssue.field];
  }

  return {
    filters: parsed.filters,
    drafts,
    issues: [
      ...currentIssues.filter(
        (validationIssue) =>
          !changedFields.some((field) => field === validationIssue.field),
      ),
      ...parsed.issues.filter((validationIssue) =>
        changedFields.some((field) => field === validationIssue.field),
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
    if (filters[key]) query.set(key, filters[key]);
    else query.delete(key);
  }

  const windowValues = query.getAll("window_hours");
  if (
    windowValues.length > 0 &&
    (windowValues.length !== 1 ||
      windowValues[0].trim() !== FIXED_WINDOW_HOURS_PARAM)
  ) {
    query.delete("window_hours");
  }

  return query;
}
