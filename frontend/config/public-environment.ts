type PublicEnvironment = Record<string, string | undefined>;

export type PublicEndpointConfiguration = {
  apiUrl: string;
  apiOrigin: string;
  connectOrigins: string[];
  strict: boolean;
  webSocketUrl: string | null;
};

const LOCAL_HOSTNAMES = new Set(["0.0.0.0", "127.0.0.1", "::1", "localhost"]);

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    LOCAL_HOSTNAMES.has(normalized) ||
    normalized.endsWith(".localhost") ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

export function isStrictPublicEnvironment(
  environment: PublicEnvironment,
): boolean {
  const vercel = environment.VERCEL?.toLowerCase();
  const vercelDeployment =
    vercel === "1" ||
    vercel === "true" ||
    ["preview", "production"].includes(
      environment.VERCEL_ENV?.toLowerCase() ?? "",
    );
  if (vercelDeployment) return true;

  const explicit = environment.BORZA_STRICT_PUBLIC_ENV?.toLowerCase();
  return (
    explicit === "true" ||
    (environment.NODE_ENV?.toLowerCase() === "production" &&
      explicit !== "false")
  );
}

function parseAbsoluteEndpoint(
  variable: string,
  rawValue: string,
  allowedProtocols: ReadonlySet<string>,
  strict: boolean,
): URL {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${variable} must be an absolute URL.`);
  }

  if (!allowedProtocols.has(url.protocol)) {
    throw new Error(
      `${variable} must use ${[...allowedProtocols].join(" or ")}.`,
    );
  }
  if (url.username || url.password) {
    throw new Error(`${variable} must not contain embedded credentials.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${variable} must not contain a query string or fragment.`);
  }
  if (strict && isLocalHostname(url.hostname)) {
    throw new Error(
      `${variable} must not target a local address in strict mode.`,
    );
  }
  return url;
}

function normalizedUrl(url: URL): string {
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

export function resolvePublicEndpointConfiguration(
  environment: PublicEnvironment,
): PublicEndpointConfiguration {
  const strict = isStrictPublicEnvironment(environment);
  const configuredApiUrl = environment.NEXT_PUBLIC_API_URL?.trim();

  if (strict && !configuredApiUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is required for Vercel and strict production builds.",
    );
  }

  let apiUrl = configuredApiUrl || "http://localhost:8000";
  let apiOrigin: string;
  if (apiUrl.startsWith("/") && !apiUrl.startsWith("//")) {
    if (strict) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be an absolute HTTPS URL in strict mode.",
      );
    }
    if (apiUrl.includes("?") || apiUrl.includes("#") || apiUrl.includes("\\")) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be a same-origin path without a query or fragment.",
      );
    }
    apiUrl = apiUrl.replace(/\/+$/, "");
    apiOrigin = "'self'";
  } else {
    const api = parseAbsoluteEndpoint(
      "NEXT_PUBLIC_API_URL",
      apiUrl,
      new Set(strict ? ["https:"] : ["http:", "https:"]),
      strict,
    );
    apiUrl = normalizedUrl(api);
    apiOrigin = api.origin;
  }

  const configuredWebSocketUrl = environment.NEXT_PUBLIC_WS_URL?.trim();
  let webSocketUrl: string | null = null;
  let webSocketOrigin: string | null = null;
  if (configuredWebSocketUrl) {
    const webSocket = parseAbsoluteEndpoint(
      "NEXT_PUBLIC_WS_URL",
      configuredWebSocketUrl,
      new Set(strict ? ["wss:"] : ["ws:", "wss:"]),
      strict,
    );
    webSocketUrl = normalizedUrl(webSocket);
    webSocketOrigin = webSocket.origin;
  } else if (apiOrigin !== "'self'") {
    const webSocket = new URL(apiOrigin);
    webSocket.protocol = webSocket.protocol === "https:" ? "wss:" : "ws:";
    webSocketOrigin = webSocket.origin;
  }

  const connectOrigins = [...new Set([apiOrigin, webSocketOrigin])]
    .filter((value): value is string => Boolean(value))
    .filter((value) => value !== "'self'");

  return {
    apiUrl,
    apiOrigin,
    connectOrigins,
    strict,
    webSocketUrl,
  };
}

export function createContentSecurityPolicy(
  configuration: PublicEndpointConfiguration,
): string {
  const connectSources = ["'self'", ...configuration.connectOrigins].join(" ");
  return [
    "default-src 'self'",
    // Next.js emits small inline bootstrap scripts for static App Router pages.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
