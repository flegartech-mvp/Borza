export type RuntimeUrlConfig = {
  value: string | null;
  issue: string | null;
};

function invalid(variable: string, expected: string): RuntimeUrlConfig {
  return {
    value: null,
    issue: `${variable} is invalid. ${expected}`,
  };
}

function withoutTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveApiBaseUrl(
  rawValue: string | undefined,
  environment: string | undefined,
): RuntimeUrlConfig {
  const value = rawValue?.trim();
  if (!value) {
    return {
      value: environment === "production" ? "" : "http://localhost:8000",
      issue: null,
    };
  }

  if (value.startsWith("/")) {
    if (
      value.startsWith("//") ||
      value.includes("?") ||
      value.includes("#") ||
      value.includes("\\")
    ) {
      return invalid(
        "NEXT_PUBLIC_API_URL",
        "Use an HTTP(S) origin or a same-origin path without a query or fragment.",
      );
    }
    return { value: withoutTrailingSlashes(value), issue: null };
  }

  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return invalid(
        "NEXT_PUBLIC_API_URL",
        "Use a credential-free HTTP(S) URL without a query or fragment.",
      );
    }
    return {
      value: withoutTrailingSlashes(`${url.origin}${url.pathname}`),
      issue: null,
    };
  } catch {
    return invalid(
      "NEXT_PUBLIC_API_URL",
      "Use an absolute HTTP(S) URL or a same-origin path.",
    );
  }
}

export function resolveWebSocketUrl(
  rawValue: string | undefined,
): RuntimeUrlConfig {
  const value = rawValue?.trim();
  if (!value) return { value: null, issue: null };
  try {
    const url = new URL(value);
    if (
      !["ws:", "wss:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return invalid(
        "NEXT_PUBLIC_WS_URL",
        "Use a credential-free WS(S) URL without a query or fragment.",
      );
    }
    return {
      value: withoutTrailingSlashes(`${url.origin}${url.pathname}`),
      issue: null,
    };
  } catch {
    return invalid("NEXT_PUBLIC_WS_URL", "Use an absolute WS(S) URL.");
  }
}

const apiConfig = resolveApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NODE_ENV,
);
const explicitWebSocketConfig = resolveWebSocketUrl(
  process.env.NEXT_PUBLIC_WS_URL,
);

export function getApiConfig(): RuntimeUrlConfig {
  return apiConfig;
}

export function getWebSocketConfig(
  browserLocation?: Pick<Location, "href">,
): RuntimeUrlConfig {
  if (explicitWebSocketConfig.issue || explicitWebSocketConfig.value) {
    return explicitWebSocketConfig;
  }
  if (apiConfig.issue) {
    return {
      value: null,
      issue:
        "The WebSocket URL could not be derived because NEXT_PUBLIC_API_URL is invalid.",
    };
  }

  const base =
    apiConfig.value && /^https?:\/\//.test(apiConfig.value)
      ? apiConfig.value
      : browserLocation?.href;
  if (!base) {
    return {
      value: null,
      issue: "The WebSocket URL cannot be derived outside a browser.",
    };
  }

  try {
    const url = new URL("/ws/news", base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return { value: url.toString(), issue: null };
  } catch {
    return {
      value: null,
      issue: "The WebSocket URL could not be derived from the API origin.",
    };
  }
}
