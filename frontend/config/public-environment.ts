type PublicEnvironment = Record<string, string | undefined>;

export type PublicEndpointConfiguration = {
  apiUrl: string;
  connectOrigins: string[];
  strict: boolean;
};

const LOCAL_HOSTNAMES = new Set(["0.0.0.0", "127.0.0.1", "::1", "localhost"]);

export function isStrictPublicEnvironment(
  environment: PublicEnvironment,
): boolean {
  const vercel = environment.VERCEL?.toLowerCase();
  if (
    vercel === "1" ||
    vercel === "true" ||
    ["preview", "production"].includes(
      environment.VERCEL_ENV?.toLowerCase() ?? "",
    )
  )
    return true;
  const explicit = environment.BORZA_STRICT_PUBLIC_ENV?.toLowerCase();
  return (
    explicit === "true" ||
    (environment.NODE_ENV === "production" && explicit !== "false")
  );
}

function parseEndpoint(variable: string, value: string, strict: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} must be an absolute URL.`);
  }
  if (
    !(strict
      ? url.protocol === "https:"
      : ["http:", "https:"].includes(url.protocol))
  ) {
    throw new Error(
      `${variable} must use ${strict ? "HTTPS" : "HTTP or HTTPS"}.`,
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `${variable} must be credential-free and contain no query or fragment.`,
    );
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    strict &&
    (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost"))
  ) {
    throw new Error(
      `${variable} must not target a local address in strict mode.`,
    );
  }
  return url;
}

export function resolvePublicEndpointConfiguration(
  environment: PublicEnvironment,
): PublicEndpointConfiguration {
  const strict = isStrictPublicEnvironment(environment);
  const configured = environment.NEXT_PUBLIC_API_URL?.trim();
  if (strict && !configured)
    throw new Error(
      "NEXT_PUBLIC_API_URL is required for strict production builds.",
    );
  let apiUrl = configured || "http://localhost:8000";
  let apiOrigin = "'self'";
  if (apiUrl.startsWith("/") && !apiUrl.startsWith("//")) {
    if (strict || /[?#\\]/.test(apiUrl))
      throw new Error(
        "NEXT_PUBLIC_API_URL must be an absolute HTTPS URL in strict mode.",
      );
    apiUrl = apiUrl.replace(/\/+$/, "");
  } else {
    const parsed = parseEndpoint("NEXT_PUBLIC_API_URL", apiUrl, strict);
    apiUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
    apiOrigin = parsed.origin;
  }
  const origins = [apiOrigin];
  const supabase = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase)
    origins.push(
      parseEndpoint("NEXT_PUBLIC_SUPABASE_URL", supabase, strict).origin,
    );
  return {
    apiUrl,
    connectOrigins: [...new Set(origins)].filter(
      (origin) => origin !== "'self'",
    ),
    strict,
  };
}

export function createContentSecurityPolicy(
  configuration: PublicEndpointConfiguration,
  development = false,
): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${configuration.connectOrigins.join(" ")}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
