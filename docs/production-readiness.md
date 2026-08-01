# Production-readiness validation

Latest validation date: 2026-07-30 (production/security blocker remediation)

## Supported runtime policy

- Backend: Python 3.12.x
- Frontend/build: Node.js 24.x
- Production database: PostgreSQL 16 or compatible Supabase PostgreSQL
- Local/test fallback: SQLite, with reduced concurrency guarantees

## Verified behavior

- Rolling API scopes use `published_at >= window_start` and
  `published_at < window_end`. The compatibility `article_count_24h` field is
  populated only for a 24-hour request.
- Feed reads are server-paginated; map and sector inputs use a separately
  bounded analysis sample with total, sample, time-window, and truncation
  metadata.
- Ingestion records durable complete/partial/failed/cancelled runs and truthful
  counters.
  Manual/cron/scheduler triggers only enqueue idempotent PostgreSQL jobs. A
  dedicated worker claims them and, after acquiring the ingestion lease,
  creates one run per execution attempt that finishes as `complete`, `partial`,
  `failed`, or `cancelled`. Lock contention defers the job without consuming an
  attempt.
- PostgreSQL job claims use row locking with `SKIP LOCKED`; claim tokens guard
  heartbeats and terminal transitions. Ingestion leases keep monotonically
  increasing generations, and the current owner/generation is fenced in the
  article transaction immediately before commit. Stale recovery conservatively
  cancels orphaned runs and requeues only eligible jobs. A worker cannot
  finalize or retry a job until the run's terminal state is durably committed;
  stale terminal-job and missing-job runs are reconciled independently.
- Provider results retain request, success/failure/saturation, malformed-row,
  retry, warning/error, and provider-timestamp coverage. GDELT errors remain
  partial/failed. OpenNews's documented Demo fallback preserves the OpenNews
  failure and therefore reports partial.
- Versioned article events publish after database commit through Valkey.
  Independent FastAPI subscribers validate and fan out the same event, while
  the browser continues authoritative REST reconciliation.
- `/live` is process-only. `/ready` and `/health` return 503 when PostgreSQL is
  unavailable or an enabled shared realtime subscription is not ready; worker
  heartbeat state is reported separately.
- Demo records, inferred geography, tone method, heuristic attention score,
  freshness, last successful ingestion, partial/failure state, and bounded
  samples are labeled in API/UI contracts.
- API, worker, scheduler, seed, and backfill startup require the database to be
  exactly at Alembic head `0009`; operational processes never create or migrate
  schema.

## Blocker-remediation validation results (2026-07-30)

- Backend format and lint passed. In the canonical Python 3.12.13 test image,
  the full suite completed with **155 passed, 6 environment/platform-gated
  skips, and 82% application coverage**. The Windows Python 3.14.6 parity run
  completed with 156 passed, 5 skips, and 81% coverage; an additional
  order-dependent regression run completed with 13 passed.
- The premium package safety suite completed with **59 passed and 3
  filesystem-capability skips**. It covers links/reparse points, archive path
  collisions, allowlisted text inputs, size bounds, secret assignments,
  credentialed URLs, authorization/session headers, common auth constructors,
  and multiline YAML/TOML credentials. Static scanning remains a safety gate,
  not a substitute for operator review.
- Frontend Prettier, ESLint, and strict TypeScript passed. Vitest completed
  **103 tests in 22 files** with 88.52% statements, 75.94% branches, 88.23%
  functions, and 90.8% lines. A strict HTTPS production build passed, and the
  negative build probe correctly rejected a missing `NEXT_PUBLIC_API_URL`.
- An empty disposable SQLite database upgraded to Alembic head `0009`;
  `alembic current` and `alembic heads` both reported `0009 (head)`.
- The disposable PostgreSQL 16/Valkey 8 profile completed **16 integration
  tests** in the Python 3.12 image. This includes concurrent automated-window
  coalescing, deterministic stale-recovery locking, lease fencing, shared
  realtime fanout, and the Supabase-marker branch of revision `0009`, including
  direct runtime-role access, browser-role denial, and future-object default
  privileges.
- Backend and frontend production images built successfully. Runtime smoke
  verified UID 10001, excluded test/lockfile assets, `0009 (head)`, `/live`,
  database/realtime `/ready`, an empty bounded news page, API security headers,
  the frontend root response, and its configured CSP.
- `pip check`, `pip-audit -r backend/requirements.txt`, and
  `npm audit --omit=dev` passed with no known production vulnerabilities.
  `docker compose config --quiet` and the PowerShell native-failure propagation
  self-test passed.
- Browser accessibility/visual smoke and live Vercel/backend/Supabase
  verification were not rerun. The release owner must still apply and verify
  live environment variables, disable the Supabase Data API, run the documented
  runtime/browser-role preflight, redeploy each service, and exercise one
  controlled ingestion job. Repository and disposable-container results do not
  prove that a live deployment was reconfigured.

## Historical Gate 0 validation results (2026-07-29)

- Backend canonical runtime: Python 3.12.13 completed Ruff format/lint and
  `pytest --cov=app` with 92 passed, 4 environment-gated integration tests
  skipped, and 79% application coverage.
- PostgreSQL/Valkey integration: 12 tests passed on Python 3.12.13 against
  PostgreSQL 16.14 and Valkey 8.1.9. They cover ticker migration and exact
  membership, concurrent idempotent enqueue/claim/recovery, lease takeover and
  stale-fence rollback before publication, a complete replacement-worker
  attempt after stale recovery, plus fanout to independent subscribers and API
  worker managers.
- Frontend: 66 tests passed with 92.33% statements, 82.25% branches, 98.27%
  functions, and 94.92% lines. Prettier, ESLint, strict TypeScript, and the
  Next.js 16.2.12 production build passed on Node.js 24.
- Alembic: empty SQLite and PostgreSQL databases upgraded through revision
  `0007`; representative `0005` data backfilled mixed-case, duplicate
  multi-ticker JSON into normalized rows before the durable queue/fencing
  migration. Malformed legacy ticker values abort before ticker DDL, and the
  SQLite rollback test preserves the `0005` compatibility JSON.
- Containers: backend and frontend production images built and run as UID/GID
  10001. The backend runtime excludes tests and local environment files while
  retaining Alembic and the backend backfill module; the frontend standalone
  runtime excludes local environment and lock files and contains `server.js`.
  The isolated integration profile publishes neither datastore port.
- Production-shaped smoke: PostgreSQL 16, Valkey 8, the one-shot migration
  service, API, worker, scheduler, and frontend all started successfully.
  `/live` returned 200; `/ready` reported database `ok`, realtime `ready`, and
  worker `ready`. A bearer-authenticated enqueue returned 202, the worker
  completed it on the first attempt, and replaying the same idempotency key
  returned the existing job instead of duplicating it.
- Browser smoke: the production dashboard rendered the live demo state,
  operator freshness counters, country-scoped panels, accessible native country
  selection, and actionable invalid-filter feedback. A 390x844 viewport had no
  horizontal document overflow; the inspected session produced zero console
  warnings or errors.
- Dependency review: `pip-audit -r backend/requirements.txt` and
  `npm audit --omit=dev` found no known production vulnerabilities. The full
  npm audit still reports nine high-severity advisories in the ESLint-only
  development chain; see `docs/security-review.md`.

See `docs/security-review.md` for dependency results and remaining security
risks. See the root `README.md` and `.env.example` for operation and deployment
instructions.
