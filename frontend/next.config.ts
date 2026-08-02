import type { NextConfig } from "next";
import path from "node:path";
import {
  createContentSecurityPolicy,
  resolvePublicEndpointConfiguration,
} from "./config/public-environment";

const publicEndpoints = resolvePublicEndpointConfiguration(process.env);
const contentSecurityPolicy = createContentSecurityPolicy(
  publicEndpoints,
  process.env.NODE_ENV === "development",
);

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  turbopack: { root: path.join(process.cwd(), "..") },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
