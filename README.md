# Borza

Borza is a beginner-friendly financial-news intelligence platform. It ingests recent market
stories, conservatively validates related symbols, labels article language/tone using a documented
method, calculates a transparent decaying editorial-attention score, deduplicates stories, and
streams new items to a responsive dashboard.

> **Financial disclaimer:** Borza provides automated informational analysis and does not
> constitute financial advice. Article-tone labels, inferred geography, and attention scores may
> be inaccurate. They do not predict price movement.

## Architecture

```text
cron/manual trigger -> PostgreSQL ingestion_jobs -> fenced ingestion worker -> articles
                                                          |                    |
                                                provider + optional AI       Valkey pub/sub
                                                                               |
Next.js dashboard <- REST reconciliation + versioned WebSocket events <- FastAPI workers
```

- `frontend/`: Next.js 16 App Router, TypeScript, Tailwind, Lucide.
- `backend/`: FastAPI, SQLAlchemy 2, Alembic, APScheduler, FinBERT service.
- `docker-compose.yml`: local PostgreSQL, Valkey, migration, API, worker,
  scheduler, and dashboard services.

## Product workspaces

Borza uses a responsive application shell with dedicated Overview, News, Map,
and Learn workspaces. Desktop navigation uses a collapsible sidebar; small
screens use a compact header, accessible menu, and bottom navigation. Theme
(System, Light, or Dark) and experience (Beginner or Expert) preferences are
stored locally and applied before hydration.

The Map workspace groups news by the geographic subject of each article.
Select Global, a supported region, or a country to scope the market brief,
detailed news results, and sector analysis together. It uses bundled
`world-atlas` TopoJSON with local SVG projection, makes no runtime map-geometry
request, and continues to work offline after installation. See
`docs/ui-redesign-checkpoint-ab.md` for the current redesign boundary.

- **Geography transparency:** backend country fields have priority. When the
  dashboard infers a location from an article title, description, source, or as
  a final ticker-domicile fallback, it preserves that distinction and marks the
  mapping as inferred.
- **Accurate counts:** mapped-story totals include only articles with a valid,
  map-representable subject country. Region-only and unmapped stories are shown
  separately and never inflate country totals.
- **Scoped analysis:** the feed is server-paginated while the map and sector
  briefing use a separately labeled bounded analysis dataset with visible
  matching totals, sample size, time window, and truncation state.
- **Honest data states:** macroeconomic values remain unavailable until a
  licensed source is connected. If the backend cannot provide news, the
  dashboard labels and uses its built-in demo fallback.
- **Responsive and accessible:** desktop uses a dense results table; small
  screens use article cards with Load More. The native country selector is the
  single keyboard interaction for the visual map, avoiding hundreds of country
  tab stops while preserving pointer selection and a polite textual summary.

## Quick start with Docker

```bash
copy .env.example .env
docker compose up --build
```

Open http://localhost:3000. GDELT is the default provider. Set
`NEWS_PROVIDER=demo` or `DEMO_MODE=true` to force an explicitly labeled local
demo feed.

## Run without Docker

Requires Python 3.12.x and Node 24.x.

```bash
copy .env.example .env
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Run a local Valkey instance, then start the dedicated worker and scheduler in
separate backend terminals:

```bash
python -m app.workers.ingestion_worker
python -m app.scheduler
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The API documentation is available at http://localhost:8000/docs.

## Configuration

Copy `.env.example` to `.env`. These variables are used:

| Variable                                                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`                                                     | `development`, `test`, `preview`, `staging`, or `production`. Every deployed mode disables API docs and automatic schema creation.                                                                                                                                                                                                                                                     |
| `DATABASE_URL`                                                    | Runtime SQLAlchemy connection string. Required in every deployed mode. Local development defaults explicitly to `sqlite:///./marketpulse.db`; deployed SQLite is rejected.                                                                                                                                                                                                             |
| `MIGRATION_DATABASE_URL`                                          | Optional direct/session database URL used only by Alembic; falls back to `DATABASE_URL`.                                                                                                                                                                                                                                                                                               |
| `DATABASE_POOL_SIZE` / `DATABASE_MAX_OVERFLOW`                    | Bounded persistent-host PostgreSQL pool (defaults 3 + 2). Supabase transaction-pooler port 6543 uses no client pool and disables prepared statements.                                                                                                                                                                                                                                  |
| `CRON_SECRET`                                                     | Server-side bearer secret required by ingestion cron and its detailed status route.                                                                                                                                                                                                                                                                                                    |
| `FINNHUB_API_KEY`                                                 | Optional server-side Finnhub key. Never expose it in `frontend/`.                                                                                                                                                                                                                                                                                                                      |
| `OPENNEWS_TOKEN`                                                  | Optional server-side OpenNews bearer token. Never expose it in `frontend/`.                                                                                                                                                                                                                                                                                                            |
| `OPENNEWS_API_BASE`                                               | OpenNews API base URL; defaults to `https://ai.6551.io`.                                                                                                                                                                                                                                                                                                                               |
| `OPENNEWS_FETCH_LIMIT`                                            | Number of OpenNews articles requested per ingestion cycle, capped at 100.                                                                                                                                                                                                                                                                                                              |
| `NEWS_PROVIDER`                                                   | `gdelt` (default), `demo`, `finnhub`, or `opennews`. GDELT needs no API key. GDELT/Finnhub failures keep stored articles and do not substitute demo data. OpenNews is the documented exception: a missing token selects the labeled Demo provider, and an authenticated OpenNews request failure uses labeled Demo records while retaining the failure as a partial-run warning/error. |
| `DEMO_MODE`                                                       | Defaults to `false`. When `true`, it forces the labeled Demo provider regardless of `NEWS_PROVIDER`; `NEWS_PROVIDER=demo` is the equivalent explicit provider selection.                                                                                                                                                                                                               |
| `GDELT_*`                                                         | DOC 2.0 URL, bounded timeout/retry/pacing/record/lookback controls and the comma-separated finance query groups. No GDELT secret exists.                                                                                                                                                                                                                                               |
| `FINBERT_ENABLED`                                                 | Defaults to `false`; keep it disabled on resource-constrained production services. `requirements-ai.txt` provides optional PyTorch/Transformers enrichment dependencies.                                                                                                                                                                                                               |
| `PREMIUM_LOCAL_DOWNLOAD_ENABLED`                                  | Development-only ZIP placeholder. Defaults to `false` and is ignored outside `ENVIRONMENT=development`.                                                                                                                                                                                                                                                                                |
| `PREMIUM_LOCAL_ARTIFACT_PATH`                                     | Development-only path for a private, ignored artifact under `premium/ai-trading-bot/artifacts/`. Never point this at `frontend/public` or commit the artifact.                                                                                                                                                                                                                         |
| `NEWS_FETCH_INTERVAL_SECONDS`                                     | Dedicated scheduler enqueue cadence, minimum 15 seconds.                                                                                                                                                                                                                                                                                                                               |
| `REALTIME_ENABLED` / `EVENT_BUS_URL`                              | Enables shared WebSocket fanout and configures the server-side Valkey/Redis URL.                                                                                                                                                                                                                                                                                                       |
| `DAILY_INGEST_*`                                                  | Bounded lookback, article, request, and minimum-window controls for daily ingestion.                                                                                                                                                                                                                                                                                                   |
| `INGESTION_LOCK_TTL_SECONDS` / `INGESTION_LOCK_HEARTBEAT_SECONDS` | Lease duration and owner heartbeat; heartbeat must be shorter than the TTL.                                                                                                                                                                                                                                                                                                            |
| `INGESTION_BATCH_SIZE`                                            | Maximum articles committed in one fenced worker transaction.                                                                                                                                                                                                                                                                                                                           |
| `INGESTION_WORKER_*` / `INGESTION_JOB_*`                          | Worker polling, heartbeat/stale recovery, attempt, and retry-backoff controls.                                                                                                                                                                                                                                                                                                         |
| `CORS_ORIGINS`                                                    | Comma-separated allowed frontend origins.                                                                                                                                                                                                                                                                                                                                              |
| `ALLOWED_HOSTS`                                                   | Comma-separated accepted API hostnames. Add deployed hosts in production.                                                                                                                                                                                                                                                                                                              |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL`                      | Public browser URLs for the deployed API and optional stream. Strict/Vercel builds require an absolute credential-free HTTPS API URL; an explicitly configured stream must use WSS.                                                                                                                                                                                                      |
| `BORZA_STRICT_PUBLIC_ENV`                                        | Build-only deployment guard. Production and Vercel builds are strict automatically; set `true` to force strict validation in another build mode. Only local Compose explicitly opts out for HTTP localhost development.                                                                                                                                                                 |

## News providers and Supabase

1. Set `NEWS_PROVIDER=gdelt`; it is the primary free provider and needs no API key. Borza requests only bounded finance query groups from the GDELT DOC 2.0 ArticleList endpoint, stores returned metadata rather than article bodies, and retries temporary failures with pacing and backoff.
2. GDELT records remain visibly attributed as **Data source: [GDELT Project](https://www.gdeltproject.org/)**. GDELT does not endorse Borza.
3. Finnhub and OpenNews remain optional adapters; neither is required for normal
   operation. OpenNews follows the workspace's explicit safe-fallback rule: a
   missing token selects the labeled Demo provider, while an upstream OpenNews
   request failure falls back to labeled Demo records and records the operation
   as partial with sanitized warning/error metadata.
4. For the persistent backend, use a Supabase direct connection (where IPv6 is available) or
   session-pooler port 5432 as `DATABASE_URL`. Use a direct/session URL for
   `MIGRATION_DATABASE_URL`. Transaction-pooler port 6543 is supported when necessary, but does
   not use SQLAlchemy's client pool. Plain `postgresql://` URLs are normalized to the
   `postgresql+psycopg://` driver and Supabase connections require SSL. Then run
   `cd backend && alembic upgrade head`.

The app uses direct PostgreSQL through SQLAlchemy, which is fully compatible with Supabase database
hosting. It does not need a browser Supabase key. Alembic revision `0009` enables RLS and revokes
`anon` and `authenticated` access on Borza tables when it detects Supabase, while its server policy
preserves existing grants for the direct FastAPI database role. Disable the Supabase Data API and
run both runtime-role and browser-role checks in `docs/supabase-vercel-setup.md`.

## Historical GDELT backfill

Historical import is an explicit operator task, not part of application startup
or the daily ingestion loop. It starts with bounded date windows for each
finance query group, automatically halves any window that reaches GDELT's
250-record ArticleList ceiling, and records completed windows in the database
so `--resume` is safe after a crash. Database duplicate protection remains in
effect for every retry.

```bash
python -m scripts.backfill_news \
  --from 2024-01-01 \
  --to 2026-07-27 \
  --provider gdelt \
  --resume
```

Do not run this command before applying migrations. If a one-minute window is
still saturated, the command stops with a visible error instead of claiming
complete coverage. The root command above is a compatibility wrapper; inside
the backend runtime image use `python -m app.services.backfill_news` with the
same arguments. Neither path scrapes publisher pages or stores article bodies.

## Premium bot distribution

The AI Trading Strategy Bot is a separate, **proprietary** paid product. Its
source code and distributable packages are not part of this public repository;
`premium/ai-trading-bot/` contains only packaging wrappers and distribution
documentation. Generated ZIPs are ignored and must be created only in an
authorized private environment, then stored in private object storage. Direct
downloads are disabled by default.
See `docs/premium-downloads.md` for the production checkout, webhook,
entitlement, private storage, and signed-URL architecture.

## API, ingestion, and WebSocket

- `GET /live`: process liveness only.
- `GET /ready`: dependency readiness; returns HTTP 503 when the database or
  configured shared realtime subscription is unavailable.
- `GET /health`: compatibility alias for readiness with the same honest 503 behavior.
- `GET /api/news`: backward-compatible bounded list, defaulting to the rolling latest 24 hours by
  `published_at`.
- `GET /api/news-page`: server pagination with total, offset, `has_more`, and window metadata.
- `GET /api/analysis`: newest bounded 500-row analysis sample with sample/total/truncation metadata.
- `GET /api/news/{article_id}`: one stored article.
- `GET /api/news-attribution`: public GDELT attribution metadata.
- `GET /api/stats`: SQL-filtered aggregates for a validated 1-168 hour window.
- `GET /api/ingestion-status`: sanitized public freshness metadata, including
  the latest queue/run state, worker heartbeat state, coverage counters, and
  most recent successful completion time.
- `POST /api/cron/ingest-news`: bearer-authenticated enqueue operation. It
  returns HTTP 202 with a durable job ID immediately; a hidden GET compatibility
  route remains for cron services that invoke GET.
- `GET /api/cron/ingest-news/status`: authenticated latest durable job/run.
- `GET /api/cron/ingest-news/jobs/{job_id}`: authenticated job and latest
  attempt status.
- `GET /api/cron/ingest-news/runs`: authenticated bounded run history and
  provider-coverage counters.
- `WS /ws/news`: sends a versioned `article.created` envelope with stable event
  and entity IDs after the article transaction commits. Every API worker
  subscribes through Valkey. The browser reconciles REST every 60 seconds while
  connected and every 15 seconds while streaming is unavailable.

All timestamps are UTC internally. Query timestamps must include an offset.

## Article tone, ticker extraction, and attention score

GDELT tone is labeled as source/article tone and is bucketed without invented confidence.
Optional FinBERT output is labeled model-inferred financial-language tone with its real model
confidence. When the model is disabled or unavailable, the neutral fallback is explicit. None of
these labels predicts price movement.

Ticker extraction is precision-first. `backend/app/services/ticker_registry.py` accepts provider
symbols and explicit `$SYMBOL`/`EXCHANGE:SYMBOL` text only when the symbol is in the reviewed local
registry; mapped company names are also supported. Generic uppercase acronyms such as ECB, SEC,
OPEC, USD, EUR, GDP, NATO, COVID, CEO, IPO, and AI are rejected. Registry additions should come
from a reviewed exchange/provider export and include regression tests.

The 0-100 attention score is a dashboard prioritization heuristic, not a financial-movement
prediction. Its persisted base combines available model confidence (up to 35), validated symbol
reach (up to 20), event terms (up to 25), and normalized established-source identity (10). Up to
10 recency points decay linearly to zero over 24 hours on every API read. “Breaking” requires an
event term, sufficient attention, and publication within 30 minutes, so it expires.

## Database and migrations

The `articles` model protects against duplicate external IDs and content hashes, stores a normalized URL, and uses recent fuzzy title matching to catch near duplicates without full-table scans. Ticker membership is normalized in `article_tickers`; its composite primary key and reverse ticker index support exact multi-ticker filtering on SQLite and PostgreSQL. The legacy `articles.tickers` JSON field is temporarily dual-written for rollback compatibility and is not used for queries or statistics. Production schema changes go through Alembic:

```bash
cd backend
alembic upgrade head
python -m app.seed
```

Run production migrations once as an operator/release job before starting replicas. Docker Compose
uses a one-shot `migrate` service; application replicas do not auto-migrate.

Revision `0006` validates and backfills legacy ticker arrays before switching
reads. Revision `0007` adds the durable queue, monotonic lease fencing,
terminal-run metadata, provider coverage, and worker/scheduler heartbeats.
Revision `0008` coalesces scheduler and external-cron jobs at the database
boundary. It unions queued coverage windows and records one continuation when
new automated coverage arrives during a running attempt.
Revision `0009` protects Borza tables from unintended Supabase Data API access.
Stop old API/scheduler/worker processes and take a backup before applying these
migrations. `0009` is the required current head; API, worker, scheduler, seed,
and backfill entry points reject any other schema state and report the exact
repair command `cd backend && python -m alembic upgrade head`.

Every lease-owning execution of a claimed job creates one run attempt that
finishes as `complete`, `partial`, `failed`, or `cancelled`; a worker that loses
the lease race defers the job without consuming an attempt. The structured
provider result records successful/failed/saturated groups, malformed rows,
per-operation retries, warnings, errors, and provider timestamps. Lease release
preserves its row; every acquisition increments a fencing generation, and the
current owner/generation must fence article commits and terminal transitions.
A conservative reconciler cancels stale runs and requeues eligible jobs.
PostgreSQL is the production coordination target; SQLite is a one-worker local
fallback.

## Checks

```bash
cd backend && ruff format --check . && ruff check . && pytest --cov=app
cd frontend && npm ci && npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run build
docker compose -f docker-compose.test.yml --profile integration up --build --abort-on-container-exit --exit-code-from backend-postgres-test backend-postgres-test
docker compose -f docker-compose.test.yml --profile integration down --volumes --remove-orphans
```

The integration profile uses Python 3.12, ephemeral PostgreSQL 16, and Valkey
without publishing either datastore port. It verifies ticker backfill/exact
membership, queue/lease concurrency, terminal recovery, and shared realtime
fanout.

## Deployment

The canonical production architecture is one Vercel project (`borza`) for
`frontend/`, persistent `borza-api`, `borza-worker`, and scheduler services, a
private Valkey service, and the existing Borza Supabase PostgreSQL project.
FastAPI is not deployed to Vercel. Alembic is the only schema authority.

- **Frontend (Vercel):** deploy only `frontend/` from `main`. Set `NEXT_PUBLIC_API_URL` to the
  verified credential-free HTTPS `borza-api` URL. Set `NEXT_PUBLIC_WS_URL` only after the host's
  WSS endpoint is verified; otherwise Borza uses its polling fallback. Vercel and strict production
  builds fail closed when the API URL is absent, insecure, credentialed, or local.
- **Backend (Render/Railway):** use the same Python 3.12 image for API, worker,
  and scheduler with different commands. Configure `DATABASE_URL`,
  `EVENT_BUS_URL`, `CORS_ORIGINS`, `ALLOWED_HOSTS`, `CRON_SECRET`, and provider
  credentials. Do not switch triggers to the queue-backed API until the worker
  heartbeat is visible.
- **Render Blueprint:** `render.yaml` declares the API, dedicated ingestion
  worker, dedicated scheduler, and private non-persistent Key Value transport.
  It intentionally uses paid `starter` compute because Render does not offer
  free background workers and the API needs a pre-deploy Alembic command.
  Review pricing and secret values before syncing the Blueprint; syncing it can
  create billable services. Automatic deploys are disabled to enforce a safe
  migration-first release:
  1. suspend the scheduler and ingestion worker;
  2. deploy the API so its pre-deploy `alembic upgrade head` completes;
  3. verify `/ready` reports the expected schema and dependencies;
  4. deploy and resume the worker, then the scheduler.

  Do not deploy revision `0006` while an older ingestion worker is writing:
  rows inserted after its backfill would not have normalized ticker rows.

- **Database (Supabase):** set the private server-side URLs and run `alembic upgrade head` once as a
  controlled release step. Revision `0009` applies repeatable RLS and browser-role revocation to
  Borza tables without affecting SQLite or ordinary PostgreSQL. Disable the unused Supabase Data
  API and complete the live checks in `docs/supabase-vercel-setup.md`. No Supabase key or database
  secret belongs in the frontend.

For a local production-shaped deployment, set a non-default
`POSTGRES_PASSWORD` in `.env` and run `docker compose up --build --detach`.
Compose waits for PostgreSQL and Valkey, runs the one-shot migration service,
then starts API, worker, scheduler, and dashboard. Inspect with
`docker compose ps` and `docker compose logs`; stop with
`docker compose down`. Add `--volumes` only when you intentionally want to
delete the local database volume.

## MVP limitations and roadmap

- FinBERT classifies financial language, not future stock movement; its large dependencies are
  optional.
- Free news APIs may be delayed and rate limited.
- The precision-first local ticker registry is intentionally incomplete and requires review to
  update.
- Fuzzy deduplication is approximate.
- Shared WebSocket delivery requires Valkey and a host that supports WebSocket
  upgrades; periodic REST reconciliation provides continuity and repairs gaps.
- Inferred geography is an estimate, not verified editorial fact; ambiguous
  country terms are deliberately handled conservatively.
- Region-only news is selectable at the region level but is not assigned to a
  country, and macroeconomic values remain unavailable until a licensed feed is
  integrated.

Recommended next steps: add authenticated saved watchlists, connect a licensed macroeconomic data source, improve provider/symbol enrichment, and add evaluation monitoring for FinBERT and impact-scoring quality.
