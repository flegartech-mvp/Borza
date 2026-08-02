# Migration verification

## Scope and outcome

Alembic head is `0015`. It is additive: user roles, partnership idempotency fields/index, and practical-table access controls. It does not import, mutate or drop legacy news tables.

## SQLite path

A new isolated SQLite database was upgraded from empty to head, checked with `alembic current` and `alembic check`, downgraded to `0014`, upgraded to head again, and rechecked. Final output: `0015 (head)` and `No new upgrade operations detected.`

The default backend suite also validates the migration graph, upgrade/downgrade behavior and role/check/index metadata.

## PostgreSQL 16 path

The disposable Compose project `borza-hardening-finalpg` built the backend test image, initialized a clean PostgreSQL 16 database and ran two integration tests successfully. Those tests:

- upgrade to head;
- verify core constraints/indexes and current schema;
- create synthetic `anon` and `authenticated` roles;
- confirm RLS is enabled and direct SELECT is revoked on practical tables;
- downgrade to 0014 and upgrade back to 0015;
- verify the new security state again.

Result: `2 passed` (one non-blocking TestClient deprecation warning). The temporary PostgreSQL data lived on tmpfs.

## Failure injection

Stopping only the labelled isolated PostgreSQL container caused `/ready` to return 503 with database `unavailable` while schema state stayed known. After restart, `/ready` recovered to 200/database `ok` without manual application restart.

## Deployment and rollback cautions

1. Back up the hosted database and verify restore procedures before migration.
2. Apply 0015 once through the migration job before new API traffic.
3. Confirm the server database role can still operate and Supabase Data API roles cannot directly query the practical tables.
4. Deploy API, then frontend; do not let replicas run migrations.
5. Application rollback comes before database downgrade. Inspect data compatibility; never reset, truncate or recreate production data.

Not verified: current hosted Supabase revision, production grants/security advisors, real backup restoration, long-running lock impact, or migration under live traffic. These are deployment gates, not local test claims.
