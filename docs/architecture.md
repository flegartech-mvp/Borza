# Borza Architecture

## Product Boundary

Borza is a German-first European market-intelligence platform. Borza Markets is the primary commercial experience; Borza Learn is a separate learning layer over the same source-backed events. Brokerage, live trading, fake pricing, university integrations, and premium artifact delivery are outside the primary runtime.

## Runtime Boundary

- `frontend/`: Next.js application only.
- `backend/`: FastAPI API, ingestion worker, scheduler, providers, models, and Alembic migrations.
- `premium/ai-trading-bot/`: packaging policy and wrappers only; no runtime dependency.

## Ingestion Flow

1. The scheduler creates an idempotent durable ingestion job.
2. A worker claims the job, maintains its heartbeat, and acquires a fenced lease.
3. `CompositeNewsProvider` runs configured providers concurrently.
4. Provider records are validated at the normalized article boundary.
5. The composite layer merges exact URL/title duplicates and bounded fuzzy candidates, preferring verified official sources.
6. `NewsWorker` calculates article tone metadata, ticker links, and relevance/attention context, then commits bounded batches.
7. Each run records provider windows, requests, retries, accepted records, duplicates, malformed records, warnings, and errors.
8. Committed article events publish through Valkey when realtime is enabled.

One provider failure produces a partial run. It does not roll back records from healthy providers.

## Provider Roles

- RSS registry: verified first-party, statistical, regulatory, or exchange publications with source ID, type, region, original language, trust tier, market relevance, polling interval, and category. German and European sources are the default priority.
- Marketaux: primary keyed DACH/EU discovery with entity, ticker, entity-sentiment, and similar-story metadata; never treated as primary truth.
- GDELT DOC 2.0: optional low-frequency global research fallback, never a release-blocking dependency.
- OpenNews: optional authenticated supplemental provider with the required labeled demo fallback behavior.
- Finnhub: optional keyed supplemental provider.
- Demo: explicit simulated data only.

The persistent scheduler separates provider cadence instead of running the whole composite on one timer: verified RSS defaults to 10 minutes, Marketaux to 20 minutes, and optional GDELT to two hours. Manual operator jobs may still execute the configured composite once.

## Article Model

The canonical record preserves provider identity, source identity/domain/type, canonical and original URLs, publication/ingestion/update times, language, geography, categories, organizations, companies, tickers, asset classes, article tone, relevance/trust scores, duplicate grouping, alternative source links, extraction status, stale status, and demo status.

Fields are nullable where providers cannot supply reliable data. Missing geography is not replaced with fake coordinates. Full third-party article bodies are not stored.

## API And Frontend

`GET /api/news-page` is the primary feed contract. Queries are bounded and support search, category, source, source type, region, language, ticker/company, date window, official-only, relevance threshold, and ordering. The response includes pagination, active filters, ingestion freshness, partial-result state, and demo state.

The Next.js frontend uses TanStack Query for request caching/retry orchestration, URL parameters for shareable filters, and WebSocket events plus REST reconciliation when realtime is available. Polling is the fallback.

The map remains a secondary experimental route. Current navigation exposes only implemented Markets, catalyst-feed, and Learn destinations. Companies, calendars, watchlists, alerts, and multilingual explanations remain roadmap capabilities until their data and workflows are operational.

See `docs/product-direction.md` for the product hierarchy and language strategy.

## Deployment

Vercel hosts only `frontend/`. A persistent container platform hosts the FastAPI API, worker, and scheduler as separate processes. PostgreSQL is the system of record; Valkey is optional for realtime fanout. Alembic runs once before new backend processes receive traffic.

See `PRODUCTION_RUNBOOK.md` for exact commands and environment ownership.
