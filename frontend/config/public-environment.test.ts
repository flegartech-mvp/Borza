import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createContentSecurityPolicy,
  isStrictPublicEnvironment,
  resolvePublicEndpointConfiguration,
} from "./public-environment";

describe("public deployment environment", () => {
  it("treats Vercel and explicit production builds as strict", () => {
    expect(isStrictPublicEnvironment({ VERCEL: "1" })).toBe(true);
    expect(isStrictPublicEnvironment({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isStrictPublicEnvironment({ NODE_ENV: "production" })).toBe(true);
    expect(isStrictPublicEnvironment({ BORZA_STRICT_PUBLIC_ENV: "true" })).toBe(
      true,
    );
    expect(
      isStrictPublicEnvironment({
        BORZA_STRICT_PUBLIC_ENV: "false",
        NODE_ENV: "production",
      }),
    ).toBe(false);
    expect(
      isStrictPublicEnvironment({
        BORZA_STRICT_PUBLIC_ENV: "false",
        VERCEL_ENV: "production",
      }),
    ).toBe(true);
    expect(isStrictPublicEnvironment({})).toBe(false);
  });

  it("requires a credential-free HTTPS API URL in strict mode", () => {
    const strict = { BORZA_STRICT_PUBLIC_ENV: "true" };
    expect(() => resolvePublicEndpointConfiguration(strict)).toThrow(
      "NEXT_PUBLIC_API_URL is required",
    );
    expect(() =>
      resolvePublicEndpointConfiguration({
        ...strict,
        NEXT_PUBLIC_API_URL: "http://api.example.com",
      }),
    ).toThrow("https:");
    expect(() =>
      resolvePublicEndpointConfiguration({
        ...strict,
        NEXT_PUBLIC_API_URL: "https://user:secret@api.example.com",
      }),
    ).toThrow("embedded credentials");
  });

  it("rejects local addresses and insecure WebSockets in strict mode", () => {
    const strict = {
      BORZA_STRICT_PUBLIC_ENV: "true",
      NEXT_PUBLIC_API_URL: "https://localhost:8000",
    };
    expect(() => resolvePublicEndpointConfiguration(strict)).toThrow(
      "local address",
    );
    expect(() =>
      resolvePublicEndpointConfiguration({
        ...strict,
        NEXT_PUBLIC_API_URL: "https://api.example.com/v1",
        NEXT_PUBLIC_WS_URL: "ws://api.example.com/ws/news",
      }),
    ).toThrow("wss:");
  });

  it("builds a strict CSP without local development origins", () => {
    const configuration = resolvePublicEndpointConfiguration({
      BORZA_STRICT_PUBLIC_ENV: "true",
      NEXT_PUBLIC_API_URL: "https://api.example.com/v1",
      NEXT_PUBLIC_WS_URL: "wss://stream.example.com/ws/news",
    });
    const policy = createContentSecurityPolicy(configuration);

    expect(policy).toContain(
      "connect-src 'self' https://api.example.com wss://stream.example.com",
    );
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/localhost|127\.0\.0\.1|0\.0\.0\.0/);
  });

  it("allows React development diagnostics only in development CSP", () => {
    const configuration = resolvePublicEndpointConfiguration({});
    expect(createContentSecurityPolicy(configuration, true)).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
    expect(createContentSecurityPolicy(configuration)).not.toContain(
      "'unsafe-eval'",
    );
  });

  it("keeps explicit local defaults available outside strict builds", () => {
    const configuration = resolvePublicEndpointConfiguration({});
    expect(configuration.apiUrl).toBe("http://localhost:8000");
    expect(configuration.connectOrigins).toEqual([
      "http://localhost:8000",
      "ws://localhost:8000",
    ]);
  });

  it("requires the API build argument in the production Dockerfile", () => {
    const dockerfile = readFileSync(
      new URL("../Dockerfile", import.meta.url),
      "utf-8",
    );

    expect(dockerfile).toMatch(/^ARG NEXT_PUBLIC_API_URL$/m);
    expect(dockerfile).toContain('test -n "$NEXT_PUBLIC_API_URL"');
    expect(dockerfile).toMatch(/^ARG BORZA_STRICT_PUBLIC_ENV=true$/m);
  });
});
