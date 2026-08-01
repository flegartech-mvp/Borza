# Borza Production Runbook

This is the canonical deployment model. The frontend and backend are separate deployments.

## Service Placement

| Service   | Host                              | Start command                                                  | Health check                      |
| --------- | --------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| Frontend  | Vercel, root `frontend/`          | managed Next.js build/start                                    | `/`                               |
| API       | Render container, root `backend/` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2` | `/ready`                          |
| Worker    | Render background worker          | `python -m app.workers.ingestion_worker`                       | operational heartbeat in database |
| Scheduler | Render background worker          | `python -m app.scheduler`                                      | operational heartbeat in database |
| Migration | Render pre-deploy job             | `alembic upgrade head`                                         | command exits successfully        |
| Database  | Supabase or PostgreSQL            | managed service                                                | checked by `/ready`               |
| Realtime  | Render Valkey                     | managed service                                                | checked by `/ready` when enabled  |

`render.yaml` defines the API, worker, scheduler, and Valkey services. Vercel deploys only `frontend/`. There is no Python runtime or ingestion cron under `frontend/`.

## Required Configuration

API:

- `ENVIRONMENT=production`
- `DATABASE_URL`
- `MIGRATION_DATABASE_URL`
- `EVENT_BUS_URL`
- `REALTIME_ENABLED=true`
- `CORS_ORIGINS=https://<frontend-host>`
- `ALLOWED_HOSTS=<api-host>`
- `CRON_SECRET`

Worker:

- `ENVIRONMENT=production`
- `DATABASE_URL`
- `EVENT_BUS_URL`
- `REALTIME_ENABLED=true`
- `NEWS_PROVIDER=composite`
- `COMPOSITE_PROVIDERS=rss,gdelt`
- optional `OPENNEWS_TOKEN` or `FINNHUB_API_KEY` only when the matching provider is enabled

Scheduler:

- `ENVIRONMENT=production`
- `DATABASE_URL`
- `NEWS_PROVIDER=composite`
- `COMPOSITE_PROVIDERS=rss,gdelt`

Frontend build:

- `NEXT_PUBLIC_API_URL=https://<api-host>`
- `NEXT_PUBLIC_WS_URL=wss://<api-host>/ws/news` when realtime is enabled

## Release Order

1. Stop or suspend the scheduler and ingestion worker for schema-changing releases.
2. Deploy backend code without routing traffic to the new API instances.
3. Run `alembic upgrade head` once using `MIGRATION_DATABASE_URL`.
4. Start the API and verify `/live` then `/ready`.
5. Start the worker and scheduler.
6. Verify `/api/health/operational` and an ingestion run.
7. Deploy the frontend with the public API and WebSocket URLs.
8. Exercise the News Explorer search, official-only filter, source link, and mobile filters.

Do not run migrations independently from every API replica.

## Migration Commands

```bash
cd backend
alembic upgrade head
alembic current
alembic check
```

Use a direct or session-pooler URL for `MIGRATION_DATABASE_URL`. The runtime can use a compatible pooler URL through `DATABASE_URL`.

## News Enablement

The no-key production baseline is:

```env
NEWS_PROVIDER=composite
COMPOSITE_PROVIDERS=rss,gdelt
DEMO_MODE=false
```

This runs the verified official RSS registry and GDELT together. A failed provider produces a partial run while successful provider records continue through normalization and ingestion.

To add OpenNews:

```env
COMPOSITE_PROVIDERS=rss,gdelt,opennews
OPENNEWS_TOKEN=<server-side token>
```

Never add `OPENNEWS_TOKEN` to Vercel frontend variables or a browser-visible name.

## Health And Operations

```bash
curl -fsS https://<api-host>/live
curl -fsS https://<api-host>/ready
curl -fsS https://<api-host>/api/health/operational
```

- `/live` proves the API process is serving.
- `/ready` checks database schema/connectivity and configured realtime dependencies.
- `/api/health/operational` reports worker/scheduler freshness and queue state.
- `/api/ingestion-status` exposes sanitized public freshness metadata used by the frontend.

Review ingestion runs for provider-specific request, accepted, duplicate, malformed, retry, warning, and failure counts. A `partial` result is actionable but does not make successful articles unavailable.

## Local Production Shape

```powershell
Copy-Item .env.example .env
docker compose config
docker compose up --build
docker compose ps
```

Expected ports are frontend `3000`, API `8000`, PostgreSQL `5432`, and internal Valkey `6379`.

## Rollback

Roll back application containers first. Database downgrades are not automatic; inspect the specific Alembic revision and data compatibility before running `alembic downgrade`. Never reset or recreate the production database as a rollback technique.
