# Borza

Borza is a European and Slovenian financial-news intelligence dashboard for students and beginning investors. It combines verified first-party publications with broad GDELT discovery, explains why an item is relevant, preserves original-source links, and labels demo or degraded data honestly.

Borza is informational software, not financial advice. Article tone and relevance scores are transparent editorial heuristics and do not predict market prices.

## Architecture

```text
ECB / GOV.SI / SEC RSS + GDELT + optional providers
                         |
                 composite ingestion
                         |
scheduler -> ingestion_jobs -> worker -> PostgreSQL -> FastAPI
                                      |                 |
                                   Valkey        REST + WebSocket
                                                        |
                                                Next.js frontend
```

Runtime applications are limited to `frontend/` and `backend/`.

- Next.js 16 frontend: Vercel or the standalone frontend container.
- FastAPI API: persistent container service.
- Ingestion worker: separate process using durable database jobs and leases.
- Scheduler: separate process that enqueues ingestion jobs.
- PostgreSQL: production database managed by Alembic.
- Valkey/Redis: realtime fanout when enabled.

The premium trading-bot package is separate from Borza runtime code and is not publicly downloadable.

## Quick Start

Requirements: Docker Desktop, or Python 3.12 and Node.js 24.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:3000`. API docs are available at `http://localhost:8000/docs` in local development.

The default `composite` provider uses official RSS feeds and GDELT without requiring a paid key. Set `DEMO_MODE=true` only when an explicitly simulated feed is wanted.

## Run Without Docker

Backend setup:

```powershell
Set-Location backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

Start the worker and scheduler in separate activated terminals:

```powershell
Set-Location backend
python -m app.workers.ingestion_worker
```

```powershell
Set-Location backend
python -m app.scheduler
```

Frontend:

```powershell
Set-Location frontend
npm ci
npm run dev
```

For local development without Valkey, set `REALTIME_ENABLED=false`; the frontend falls back to bounded polling.

## News Sources

Operational by default:

- European Central Bank press feed: official, Europe, English.
- Slovenian Ministry of Finance GOV.SI feed: official, Slovenia, Slovenian.
- US Securities and Exchange Commission press feed: regulator, United States, English.
- GDELT DOC 2.0: broad discovery only, with bounded finance query groups and visible attribution.

Optional:

- OpenNews with `OPENNEWS_TOKEN`.
- Finnhub with `FINNHUB_API_KEY`.

Banka Slovenije, ESMA, and Ljubljana Stock Exchange/SEOnet remain candidates, but Borza does not scrape them or ship a dead feed URL. Add them only after a stable, permitted publication feed or API is verified.

Configure the provider set with:

```env
NEWS_PROVIDER=composite
COMPOSITE_PROVIDERS=rss,gdelt
```

Allowed standalone values are `composite`, `rss`, `gdelt`, `opennews`, `finnhub`, and `demo`. Missing OpenNews credentials retain the required labeled demo fallback; failures from one composite provider do not discard successful results from others.

## Environment

Copy `.env.example` and change values for the target environment.

| Variable                 | Service                | Purpose                                                                  |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`           | API, worker, scheduler | SQLAlchemy PostgreSQL URL; local file-backed SQLite is development-only. |
| `MIGRATION_DATABASE_URL` | migration job          | Direct/session PostgreSQL URL for Alembic when runtime uses a pooler.    |
| `NEWS_PROVIDER`          | worker, scheduler      | Canonical provider mode; defaults to `composite`.                        |
| `COMPOSITE_PROVIDERS`    | worker                 | Ordered provider set; defaults to `rss,gdelt`.                           |
| `OPENNEWS_TOKEN`         | worker                 | Optional server-side OpenNews bearer token.                              |
| `FINNHUB_API_KEY`        | worker                 | Optional server-side Finnhub key.                                        |
| `CRON_SECRET`            | API                    | Bearer secret for operator ingestion endpoints.                          |
| `EVENT_BUS_URL`          | API, worker            | Valkey/Redis connection URL.                                             |
| `REALTIME_ENABLED`       | API, worker            | Enables shared WebSocket publication; polling remains available.         |
| `CORS_ORIGINS`           | API                    | Comma-separated frontend origins.                                        |
| `ALLOWED_HOSTS`          | API                    | Accepted API hostnames.                                                  |
| `NEXT_PUBLIC_API_URL`    | frontend build         | Absolute public FastAPI URL. HTTPS is required for deployed builds.      |
| `NEXT_PUBLIC_WS_URL`     | frontend build         | Optional absolute WSS news-stream URL.                                   |

Never expose provider, database, or cron credentials through `NEXT_PUBLIC_*` variables.

## Database Migrations

Runtime processes verify that the schema is current and never create tables automatically.

```powershell
Set-Location backend
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

Run migrations once before starting a new API or worker release.

## API

Health endpoints:

- `GET /live`: process liveness.
- `GET /ready`: database and configured realtime readiness.
- `GET /api/health/operational`: worker, scheduler, queue, and ingestion freshness.

The primary feed is `GET /api/news-page`. It supports bounded pagination, search, category, source, source type, region, language, company/ticker, publication window, official-only, minimum relevance, and `newest`, `relevance`, or `most_covered` ordering. Responses include active filters, ingestion freshness, demo status, and partial-result status.

## Tests

Backend:

```powershell
Set-Location backend
python -m ruff format --check .
python -m ruff check .
python -m pytest -q
```

Frontend:

```powershell
Set-Location frontend
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:run
npm run build
npx playwright install chromium
npm run test:e2e
```

Infrastructure:

```powershell
docker compose config
docker build --target test -t borza-backend-test ./backend
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t borza-frontend ./frontend
```

## Deployment

The canonical hosted model is:

- Vercel project root `frontend/`: Next.js only.
- Render Blueprint `render.yaml`: FastAPI API, ingestion worker, scheduler, and Valkey.
- Supabase or standard PostgreSQL: primary database.

Set `NEXT_PUBLIC_API_URL` and optional `NEXT_PUBLIC_WS_URL` in Vercel. Set backend secrets only on the API/worker/scheduler host. Do not deploy `backend/` through Vercel and do not configure a frontend cron. See `PRODUCTION_RUNBOOK.md` for the release order and health checks.

## Known Limitations

- GDELT is a discovery source; publisher quality varies and should be judged through source metadata.
- Official-source coverage is limited to verified feeds in the registry.
- Full article text is not republished; cards use provider/feed summaries and original links.
- Relevance, tone, and inferred geography are explainable heuristics, not validated market-impact predictions.
- Map coverage remains a secondary experimental route and is not part of primary navigation.
- Production checkout/private delivery for the separate premium bot is not configured.
