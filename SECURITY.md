# Borza Security Policy & Hardening Guidelines

## 1. Threat Model & Security Boundaries

Borza is a public financial intelligence and news aggregator platform. Its primary security boundaries protect:
1. Internal databases and secrets from unauthorized external access.
2. Server resources from Server-Side Request Forgery (SSRF) and Denial of Service (DoS).
3. Browser clients from Cross-Site Scripting (XSS) and Clickjacking.

---

## 2. Secrets & Credential Protection

- **No Secrets in Source Control**: Credentials, tokens, private keys, and passwords must never be committed to Git repositories or exposed in browser-visible variables.
- **`NEXT_PUBLIC_` Scoping**: Only non-sensitive URLs (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`) are exposed to the browser client.
- **Provider Keys**: API tokens (e.g. `OPENNEWS_TOKEN`, `FINNHUB_API_KEY`) remain strictly server-side inside `backend/`.

---

## 3. SSRF Defense Specification

Borza ingests external RSS/Atom feeds and provider webhooks. To prevent SSRF attacks against internal network assets (such as Cloud Metadata services, internal databases, or localhost services), all target URLs undergo pre-flight validation (`validate_safe_url` in `backend/app/providers/rss.py`):

1. **Protocol Restriction**: Only `http://` and `https://` schemes are permitted.
2. **Blocked Hosts**: Immediate rejection of `localhost`, `127.0.0.1`, `::1`, and `metadata.google.internal`.
3. **IP Range Restrictions**: Hostnames are resolved to IP addresses and checked against:
   - Private IPv4 blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - Loopback range (`127.0.0.0/8`)
   - Link-local & Metadata IPs (`169.254.0.0/16` / `169.254.169.254`)
4. **Redirect Handling**: HTTP redirect auto-following is disabled. Redirect destinations (`Location` header) are independently validated against SSRF rules before execution.

---

## 4. Rate Limiting & Connection Abuse Controls (BRZ-004)

- **Distributed Rate Limiting**: Production API routes use Valkey-backed rate limiting (`RateLimitMiddleware`).
- **HTTP 429 & Retry-After**: Excess requests receive a `429 Too Many Requests` status code with an explicit `Retry-After` header indicating delay in seconds.
- **WebSocket Connection Budget**: The `ConnectionManager` enforces max concurrent connection limits (`100` connections) per client IP.

---

## 5. Content Security Policy (CSP - BRZ-012)

The Next.js frontend enforces a strict Content Security Policy without `unsafe-inline` in `script-src`:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' ws: wss: https:; frame-ancestors 'none'; object-src 'none';
```

- Blocks unauthorized inline script execution.
- Disables framing (`frame-ancestors 'none'`) to prevent Clickjacking.

---

## 6. Dependency Auditing & Supply Chain (BRZ-011)

- Automated Python dependency auditing via `pip_audit`.
- Automated Node dependency auditing via `npm audit`.
- Pinned commit SHAs in GitHub Actions workflows.
