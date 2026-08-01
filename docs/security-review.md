# Targeted security review

Review date: 2026-07-30

## Implemented controls

- API query windows, offsets, limits, search text, sectors, symbols, and score
  thresholds are bounded through FastAPI validation in
  `backend/app/api/routes/news.py`. Database filters use SQLAlchemy expressions;
  user input is never interpolated into SQL.
- Provider and article URLs accept only absolute HTTP(S) URLs without embedded
  credentials (`backend/app/core/config.py` and
  `backend/app/providers/base.py`). Unsafe article protocols are discarded
  before persistence, and the frontend independently refuses unsafe external
  links.
- `CORS_ORIGINS` is an explicit validated origin list. Wildcards, paths,
  credentials, and malformed values are rejected; credentials are disabled in
  CORS middleware. `ALLOWED_HOSTS` feeds trusted-host middleware and cannot use
  a production wildcard (`backend/app/core/config.py` and
  `backend/app/main.py`).
- Cron enqueue and detailed job/run status routes require a server-side bearer
  secret. Comparison is constant-time, unauthenticated requests receive 401,
  and no configured secret fails closed. Trigger requests enqueue durable,
  idempotency-keyed jobs and never execute provider/model work in the API
  process (`backend/app/api/routes/cron.py`).
- PostgreSQL claims use claim tokens and `SKIP LOCKED`. Lease ownership and its
  monotonic fencing generation are checked in the article transaction before
  commit and again for job/run terminal transitions, preventing a stale worker
  from committing or publishing after takeover.
- Browser WebSocket origins are restricted to the configured CORS set.
  Malformed client frames are ignored without reflecting raw payloads, and the
  frontend validates parsed server events before use. Valkey subscribers also
  enforce a strict versioned event schema and payload-size limit before local
  fanout; slow browser clients are closed rather than allowed to grow an
  unbounded queue
  (`backend/app/api/websocket.py` and
  `backend/app/events/bus.py` and `frontend/lib/news-stream-utils.ts`).
- Provider tokens remain server-side. Public ingestion status excludes internal
  error detail, and readiness responses never include database URLs or
  exception messages.
- Provider records cross a strict persistence boundary for field types, sizes,
  URLs, timestamps, tickers, and sentiment metadata. OpenNews bearer tokens are
  limited to the token68 character set and are explicitly removed from durable
  provider errors. A queued OpenNews or Finnhub job whose credential was
  removed fails under its original provider identity instead of silently
  executing Demo or GDELT data.
- Scheduler and external-cron jobs share one active-job database invariant per
  provider/job type. Concurrent requests atomically union their desired time
  windows; a widened running attempt creates one continuation, and stale
  recovery preserves coverage for missing, running, failed, or already
  terminal attempt records. PostgreSQL stale reconciliation locks jobs and runs
  in deterministic ID order to prevent multi-row lock inversion.
- Runtime entry points verify that the database is exactly at Alembic head
  `0009` and fail with a fixed operator repair command instead of creating or
  mutating schema automatically.
- Revision `0009` enables RLS and revokes `anon` and `authenticated` privileges
  for Borza tables only when Supabase markers are present. SQLite and ordinary
  PostgreSQL remain unchanged. Its policy admits only directly granted roles
  outside those browser-role membership trees, preventing a distinct FastAPI
  runtime role from being silently blocked by RLS. It also prevents future
  migration-role functions from inheriting PostgreSQL's global `PUBLIC`
  execution grant. The unused Supabase Data API must also be disabled and
  verified as documented in
  `docs/supabase-vercel-setup.md`.
- The API and frontend set clickjacking, MIME-sniffing, referrer, permissions,
  and content security headers (`backend/app/main.py` and
  `frontend/next.config.ts`). External links use safe rel attributes; no
  `dangerouslySetInnerHTML`, dynamic evaluation, or raw HTML injection is used.
- Production images contain only runtime assets and run as UID/GID 10001. The
  optional model stack is excluded unless `INSTALL_AI=true`.
- Strict/Vercel frontend builds reject missing, insecure, credentialed, or
  local API endpoints and derive CSP connection origins only from validated
  public URLs. Validation scripts use disposable databases and explicitly
  propagate native command failures.
- The proprietary bot packager allowlists UTF-8 text inputs, rejects links,
  unsafe/colliding archive paths and binary-risk files, archives the exact
  scanned bytes atomically, and detects common assignment, URI, header,
  cookie, curl, Python auth-constructor, YAML, and TOML credential forms.

## Dependency review

- `pip-audit -r backend/requirements.txt`: no known vulnerabilities.
- `npm audit --omit=dev`: no known production vulnerabilities.
- Full `npm audit`: nine high-severity denial-of-service advisories in the
  ESLint development dependency chain (`brace-expansion` through `minimatch`).
  The registry-proposed automated fix requires a breaking ESLint 10 upgrade, so
  it was not forced into this change. This does not affect the deployed
  standalone runtime image, but CI/developer machines should avoid linting
  untrusted repositories until the Next.js ESLint toolchain supports a
  compatible fix.

## Residual risks

- Application-level rate limiting is not implemented. Public read endpoints are
  bounded, but production should add edge/gateway rate limits for REST and
  WebSocket connection attempts.
- Provider base URLs are operator-controlled configuration. They are validated
  as credential-free HTTP(S) URLs, but private-address blocking is not enforced
  because private/self-hosted provider deployments are valid. Restrict who can
  change production environment variables and apply egress controls if that
  trust model changes.
- The frontend CSP permits inline scripts/styles required by the current Next.js
  production bootstrap and styling pipeline. It does not permit `eval`, object
  embedding, framing, or arbitrary connect origins. A nonce-based policy is a
  worthwhile future hardening project.
- Premium package secret detection is intentionally conservative and cannot
  prove that deliberately obfuscated credentials are absent. A human review
  remains required before any private ZIP is uploaded or delivered.
- The WebSocket publishes public news and has no user authentication. Do not put
  private watchlists, entitlements, or account data on this channel without a
  separate authenticated protocol.
- Valkey pub/sub is an internal, non-durable transport. Keep it off the public
  internet, require provider-supported transport authentication/encryption, and
  continue treating periodic REST reads as the authoritative recovery path.
