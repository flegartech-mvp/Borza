export type RuntimeUrlConfig = { value: string | null; issue: string | null };

function invalid(variable: string, expected: string): RuntimeUrlConfig {
  return { value: null, issue: `${variable} is invalid. ${expected}` };
}

export function resolveApiBaseUrl(
  rawValue: string | undefined,
  environment: string | undefined,
): RuntimeUrlConfig {
  const value = rawValue?.trim();
  if (!value) {
    return { value: environment === "production" ? "" : "http://localhost:8000", issue: null };
  }
  if (value.startsWith("/") && !value.startsWith("//")) {
    if (/[?#\\]/.test(value)) {
      return invalid("NEXT_PUBLIC_API_URL", "Use a same-origin path without query, fragment, or backslash.");
    }
    return { value: value.replace(/\/+$/, ""), issue: null };
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      return invalid("NEXT_PUBLIC_API_URL", "Use a credential-free HTTP(S) URL without query or fragment.");
    }
    return { value: `${url.origin}${url.pathname}`.replace(/\/+$/, ""), issue: null };
  } catch {
    return invalid("NEXT_PUBLIC_API_URL", "Use an absolute HTTP(S) URL or same-origin path.");
  }
}

const apiConfig = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, process.env.NODE_ENV);

export function getApiConfig(): RuntimeUrlConfig {
  return apiConfig;
}

export function getSupabasePublicConfig(): {
  configured: boolean;
  url: string | null;
  publishableKey: string | null;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || null;
  if (!url || !publishableKey) return { configured: false, url, publishableKey };
  try {
    const parsed = new URL(url);
    const valid = parsed.protocol === "https:" && !parsed.username && !parsed.password;
    return { configured: valid, url: valid ? parsed.origin : null, publishableKey };
  } catch {
    return { configured: false, url: null, publishableKey };
  }
}
