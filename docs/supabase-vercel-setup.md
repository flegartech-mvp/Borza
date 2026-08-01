# Supabase, Vercel, and backend setup

Do not commit credentials. Environment-variable changes require a redeploy.

## Supabase PostgreSQL

1. Use the existing Borza project and open **Connect**.
2. For persistent FastAPI traffic, prefer the direct URL where IPv6 is available or the
   session-pooler URL on port 5432. Set it as the server-only `DATABASE_URL`.
3. Set `MIGRATION_DATABASE_URL` to a direct or session-pooler URL for controlled Alembic releases.
4. Stop writers and run `alembic upgrade head` once before starting new replicas. Revision `0009`
   enables RLS and revokes table and sequence privileges from `anon` and `authenticated` for every
   Borza table. Its `borza_direct_server_access` policy preserves access for direct database roles
   that already have the required SQL grants, while denying `anon`, `authenticated`, and roles that
   inherit from either one. The revision also revokes their default privileges for objects
   subsequently created by the migration role and removes PostgreSQL's global default `PUBLIC`
   execution grant from future functions.
5. Because Borza uses only direct server-side PostgreSQL connections, open the Supabase Dashboard's
   **Data API integration** and turn **Enable Data API** off. This is the preferred outer boundary;
   grants and RLS remain defense in depth. See the official
   [Supabase Data API security guide](https://supabase.com/docs/guides/api/securing-your-api).

Revision `0009` is portable: it is a no-op on SQLite and on ordinary PostgreSQL databases that do
not contain the Supabase `anon` and `authenticated` roles plus the `auth` schema. Its downgrade does
not re-grant browser roles; a code rollback must never silently reopen database access.

### Verify the live project

Before the release, connect with the exact server-only `DATABASE_URL` used by FastAPI and record the
result of the following read-only preflight. `can_read`, `can_insert`, `can_update`, and
`can_allocate_article_id` must all be true for the worker role. Run it again after migration `0009`;
the count query must still succeed. A failure means the runtime role lacks normal SQL grants and the
release must remain stopped until those grants are corrected.

```sql
select
  current_user,
  has_table_privilege(current_user, 'public.articles', 'SELECT') as can_read,
  has_table_privilege(current_user, 'public.articles', 'INSERT') as can_insert,
  has_table_privilege(current_user, 'public.articles', 'UPDATE') as can_update,
  has_sequence_privilege(
    current_user,
    'public.articles_id_seq',
    'USAGE'
  ) as can_allocate_article_id;

select count(*) from public.articles;
```

Run these read-only checks in the Supabase SQL Editor after the migration. The first query must show
`rowsecurity = true` and the named server policy for every listed table. The two effective-privilege
queries must return zero rows.

```sql
select c.relname, c.relrowsecurity, p.polname
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
left join pg_policy as p
  on p.polrelid = c.oid
 and p.polname = 'borza_direct_server_access'
where n.nspname = 'public'
  and c.relname in (
    'alembic_version',
    'articles',
    'article_tickers',
    'backfill_checkpoints',
    'ingestion_locks',
    'ingestion_jobs',
    'service_heartbeats',
    'ingestion_runs'
  )
order by c.relname;

with data_api_roles(role_name) as (
  values ('anon'::name), ('authenticated'::name)
),
application_tables(table_name) as (
  values
    ('alembic_version'),
    ('articles'),
    ('article_tickers'),
    ('backfill_checkpoints'),
    ('ingestion_locks'),
    ('ingestion_jobs'),
    ('service_heartbeats'),
    ('ingestion_runs')
),
table_privileges(privilege_name) as (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
)
select role_name, table_name, privilege_name
from data_api_roles
cross join application_tables
cross join table_privileges
where has_table_privilege(
  role_name,
  'public.' || table_name,
  privilege_name
);

with data_api_roles(role_name) as (
  values ('anon'::name), ('authenticated'::name)
),
application_sequences(sequence_name) as (
  values
    ('articles_id_seq'),
    ('backfill_checkpoints_id_seq'),
    ('ingestion_locks_id_seq'),
    ('ingestion_jobs_id_seq'),
    ('ingestion_runs_id_seq')
),
sequence_privileges(privilege_name) as (
  values ('USAGE'), ('SELECT'), ('UPDATE')
)
select role_name, sequence_name, privilege_name
from data_api_roles
cross join application_sequences
cross join sequence_privileges
where has_sequence_privilege(
  role_name,
  'public.' || sequence_name,
  privilege_name
);
```

Confirm the Dashboard reports the Data API as disabled, then verify the FastAPI `/ready` endpoint
and one normal news request through the deployed backend. Trigger one controlled ingestion run and
confirm it can insert and update an article before restarting the scheduler. Do not add a Supabase
URL, anon key, service-role key, or database credential to the frontend.

## Persistent FastAPI backend

Deploy persistent `borza-api`, `borza-worker`, and `borza-scheduler` services
from the same backend image and commit, plus a private Valkey/Redis-compatible
service. Run `uvicorn app.main:app` for the API,
`python -m app.workers.ingestion_worker` for the worker, and
`python -m app.scheduler` for the scheduler. Configure `DATABASE_URL`,
`MIGRATION_DATABASE_URL`, `EVENT_BUS_URL`, `CRON_SECRET`, `CORS_ORIGINS`,
`ALLOWED_HOSTS`, and provider variables as server-only secrets.

Run migrations as a separate release operation before starting the new
replicas. Confirm the worker heartbeat in `/api/ingestion-status`, use `/ready`
for API/database/realtime readiness, and verify `/ws/news` before publishing a
WebSocket URL. Do not enable scheduler or external cron triggers until the
queue worker is live. FastAPI is not deployed to Vercel.

## Vercel frontend

The single Vercel project `borza` builds `frontend/` from `main` with `npm ci` and
`npm run build`. Vercel builds fail unless `NEXT_PUBLIC_API_URL` is an absolute, credential-free
HTTPS URL for the verified backend. Set `NEXT_PUBLIC_WS_URL` only after WebSockets are verified; in
strict builds it must use WSS. Otherwise polling is the honest fallback. Generic production
builders are strict automatically; `BORZA_STRICT_PUBLIC_ENV=true` can force the same checks in
another build mode. The production frontend Dockerfile defaults to strict mode and requires an
explicit `NEXT_PUBLIC_API_URL` build argument. Do not add PostgreSQL, Supabase, cron, or provider
credentials to Vercel.

## Rollback

Disable the scheduler and external cron, stop the queue worker, redeploy the
previous frontend/backend services, inspect the latest job and run, and do not
destructively downgrade database migrations without a reviewed plan.
