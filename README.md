# Borza

Borza is a German-first European market-intelligence platform for active investors and traders, with a separate learning layer for Slovenian and European finance students. It turns German and European market news into structured catalysts and understandable financial knowledge while preserving original-source links and labeling demo, stale, or degraded data honestly.

Borza is informational software, not financial advice. Article tone and relevance scores are transparent editorial heuristics and do not predict market prices.

## Architecture

```text
German / European official RSS + Marketaux + optional GDELT
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

The default `composite` provider always uses official RSS feeds and adds Marketaux when `MARKETAUX_API_TOKEN` is configured. Without the token, official RSS remains healthy and no demo or GDELT data is silently substituted. Set `DEMO_MODE=true` only when an explicitly simulated feed is wanted.

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

- Deutsche Bundesbank general feed: official, Germany, German.
- Destatis current releases: official statistics, Germany, German.
- Deutsche Börse press releases: exchange, Germany, English.
- Xetra and Frankfurt Newsboard: exchange operations, Germany, English.
- Deutsche Börse circulars: exchange notices, Germany, English.
- European Central Bank press feed: official, Europe, English.
- Slovenian Ministry of Finance GOV.SI feed: official, Slovenia, Slovenian.

Optional:

- Marketaux with `MARKETAUX_API_TOKEN`: primary broad discovery for DACH/EU entities, German and English articles, ticker metadata, entity sentiment, and similar-story hints.
- GDELT DOC 2.0: low-frequency global research fallback with bounded finance query groups and visible attribution.
- OpenNews with `OPENNEWS_TOKEN`.
- Finnhub with `FINNHUB_API_KEY`.

EQS News is a high-value company-disclosure target, but Borza does not scrape or redistribute it until technical access and commercial licensing terms are verified. BaFin, ESMA, European Commission releases, Banka Slovenije, and permitted company investor-relations feeds also remain candidates. Borza does not ship guessed or dead endpoints.

See `docs/product-direction.md` for the Borza Markets and Borza Learn boundaries and the honest delivery order for catalysts, companies, calendars, watchlists, alerts, and multilingual learning.

Configure the provider set with:

```env
NEWS_PROVIDER=composite
COMPOSITE_PROVIDERS=rss,marketaux
MARKETAUX_API_TOKEN=replace-with-a-server-side-token
```

Allowed standalone values are `composite`, `rss`, `marketaux`, `gdelt`, `opennews`, `finnhub`, and `demo`. A missing Marketaux token disables it inside the composite while official RSS continues; a persisted standalone Marketaux job fails explicitly if its token was removed. Failures from one composite provider do not discard successful results from others.

The persistent scheduler uses provider-specific defaults: RSS every 10 minutes, Marketaux every 20 minutes, and optional GDELT every 2 hours. The Marketaux default is three articles per request so the free-plan limit is not accidentally exceeded; changing plan or cadence is an operator decision.

## Environment

Copy `.env.example` and change values for the target environment.

| Variable                 | Service                | Purpose                                                                  |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`           | API, worker, scheduler | SQLAlchemy PostgreSQL URL; local file-backed SQLite is development-only. |
| `MIGRATION_DATABASE_URL` | migration job          | Direct/session PostgreSQL URL for Alembic when runtime uses a pooler.    |
| `NEWS_PROVIDER`          | worker, scheduler      | Canonical provider mode; defaults to `composite`.                        |
| `COMPOSITE_PROVIDERS`    | worker, scheduler      | Ordered provider set; defaults to `rss,marketaux`.                        |
| `MARKETAUX_API_TOKEN`    | API, worker, scheduler | Optional server-side Marketaux token; never expose it through the client. |
| `MARKETAUX_FETCH_INTERVAL_SECONDS` | scheduler | Marketaux cadence; defaults to 1,200 seconds.                             |
| `RSS_FETCH_INTERVAL_SECONDS` | scheduler           | Official RSS cadence; defaults to 600 seconds.                            |
| `GDELT_FETCH_INTERVAL_SECONDS` | scheduler         | Optional GDELT cadence; defaults to 7,200 seconds.                        |
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

- Marketaux and optional GDELT results are discovery metadata; publisher quality still varies and must be judged through source labels and original links.
- Marketaux free-plan coverage is intentionally quota-bounded to three articles per 20-minute request. It is useful for development, not equivalent to a licensed real-time professional feed.
- EQS, dpa-AFX, and exchange market-data redistribution are not implemented or licensed.
- Official-source coverage is limited to verified feeds in the registry.
- Full article text is not republished; cards use provider/feed summaries and original links.
- Relevance, tone, and inferred geography are explainable heuristics, not validated market-impact predictions.
- Map coverage remains a secondary experimental route and is not part of primary navigation.
- Production checkout/private delivery for the separate premium bot is not configured.
