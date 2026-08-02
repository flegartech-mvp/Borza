# Borza Academy Production Runbook

The Academy branch is not production-authorized until the complete verification gate passes and an explicit merge/deploy decision is made.

## Service placement

| Service | Host | Start command | Health |
| --- | --- | --- | --- |
| Frontend | Vercel, project root `frontend/` | managed Next.js build/start | `/` |
| API | Render container, root `backend/` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2` | `/ready` |
| Migration | Render pre-deploy command | `alembic upgrade head` | successful exit |
| Database | Supabase or PostgreSQL 16 | managed service | checked by `/ready` |
| Auth | Supabase Auth | managed service | verified through authenticated API request |

There is no Academy worker, scheduler, Valkey service, news provider, WebSocket, or real-time market-data service.

## Required configuration

API:

- `ENVIRONMENT=production`
- `DATABASE_URL`
- `MIGRATION_DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `ACADEMY_ALLOW_DEMO_AUTH=false`
- `CORS_ORIGINS=https://<frontend-host>`
- `ALLOWED_HOSTS=<api-host>`

Frontend build/runtime:

- `NEXT_PUBLIC_API_URL=https://<api-host>`
- `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>`

Never configure a Supabase secret or `service_role` key as `NEXT_PUBLIC_*`.

## Release order

1. Validate authored content and the full repository gate on the exact commit.
2. Back up the production database according to the database host’s procedure.
3. Review every pending Alembic revision and confirm it contains no legacy-table drops.
4. Run `alembic upgrade head` once with `MIGRATION_DATABASE_URL`.
5. Deploy the API; verify `/live`, `/ready`, OpenAPI title, public catalogue, and one authenticated owner-scoped request.
6. Deploy the frontend; verify landing/demo, sign-in, onboarding, lesson, review, simulator, calculator, journal, locale, theme, mobile navigation, CSP, and console.
7. Monitor API errors, auth failures, database saturation, and frontend Core Web Vitals.

Do not run migrations independently from every API replica.

## Migration checks

```bash
cd backend
alembic upgrade head
alembic current
alembic check
```

Test both a clean database and an existing database at legacy head `0011`. Normal Academy upgrades must preserve legacy news rows. Cleanup is a separate, explicit operator workflow.

## Health and smoke checks

```bash
curl -fsS https://<api-host>/live
curl -fsS https://<api-host>/ready
curl -fsS https://<api-host>/api/v1/learning-paths
curl -fsS https://<frontend-host>/
```

An authenticated smoke test must use a disposable test account and verify that a second user cannot access its notes, journal, progress, or simulation session.

## Local production shape

```powershell
Copy-Item .env.example .env
docker compose config --quiet
docker compose up --build
docker compose ps
```

Expected ports are frontend `3000`, API `8000`, and PostgreSQL `5432`.

## Rollback

Roll back application images first. Database downgrades are never automatic: inspect the exact revision and data compatibility before running a downgrade. Never reset, truncate, or recreate production data as a rollback technique.
