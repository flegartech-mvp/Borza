# Security review

This repository-grounded review covers authentication/authorization, ownership, API validation, classroom isolation, assessment integrity, HTTP controls, abuse protection, dependency/secret hygiene, and failure behavior. It is not a claim that the hosted production environment was penetration-tested.

## Finding summary

The complete register is in `findings.json`: 0 critical, 3 high, 13 medium, and 4 low. All three high findings are fixed. Four findings remain open: browser-local demo scoring metadata (medium), distributed rate limiting (medium), CSP `unsafe-inline` (medium), and public SEO metadata (low). Retention is mitigated in code but still requires an operator schedule.

## Confirmed high findings

### BORZA-QA-001 — Teacher APIs lacked role authorization

- Rule ID: AUTHZ-TEACHER-01
- Severity: High; status: fixed.
- Location: `backend/app/api/deps/auth.py:20,127`; enforced at `backend/app/api/routes/practical.py:417,456,470,524,533`.
- Evidence: a baseline learner identity could call teacher routes; owner scoping alone did not distinguish teachers from learners.
- Impact: any signed-in learner could create a class and use teacher dashboards/exports for sessions they owned.
- Fix: accept only protected `app_metadata.borza_role` values, reject user metadata, persist a checked role, and require teacher/admin on every teacher API. Learners now receive 403; a different teacher receives 404.
- Mitigation/regression: role-claim, learner denial, and cross-teacher tests are in `test_migrations_and_auth.py` and `test_practical_finance.py`.
- False-positive note: this was reproducible in code/tests, not a theoretical claim.

### BORZA-QA-002 — Practical tables lacked explicit Data API defense

- Rule ID: DB-RLS-01
- Severity: High; status: fixed.
- Location: `backend/alembic/versions/0015_platform_hardening.py:35-42`.
- Evidence: 0014 created seven practical tables without explicit RLS/revoke statements, relying on earlier defaults.
- Impact: grant drift or a Supabase exposure change could make sensitive evidence queryable outside FastAPI ownership checks.
- Fix: 0015 enables RLS, revokes `anon`/`authenticated`, and creates server-only policies.
- Mitigation/regression: real PostgreSQL tests create synthetic Supabase roles and confirm no SELECT privilege/RLS bypass.
- False-positive note: no confirmed production leak was observed; the missing explicit control was confirmed.

### BORZA-QA-003 — Production frontend image was unshippable

- Rule ID: REL-CONTAINER-01
- Severity: High release risk; status: fixed.
- Location: `frontend/Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/ci.yml`.
- Evidence: the baseline context could not resolve root `content/` imports; after correcting context, runtime initially failed to locate `/app/server.js` because tracing placed it at `/app/frontend/server.js`.
- Impact: build or container start failure at release time.
- Fix: repository-root build context, explicit content copy, correct tracing layout/workdir, non-root runtime, health check, and a CI container-build gate.
- Mitigation/regression: strict image built and ran healthy in the isolated stack.
- False-positive note: both failures were directly reproduced.

## Important medium findings

- Public answer/scoring keys were removed recursively (`practical.py:68-110`), and chart/calculator response schemas no longer expose solutions. Runtime scan found zero forbidden keys.
- All write schemas derive from strict `RequestModel` (`schemas/academy.py:13`); an attempted `role=admin` extra field returns 422.
- Rate limiting uses the socket peer, bounded client state, 240/minute general, 30/minute sensitive, and 120/minute classroom-join buckets (`rate_limiter.py:10-90`). Rotating `X-Forwarded-For` produced 30 validation responses then five 429 responses.
- Streamed/declared request bodies over 256 KiB return 413 (`request_limits.py:8`; `main.py:60`).
- Life Simulator writes lock the current row (`practical.py:336`); partnership retries use hashed idempotency keys/fingerprints (`practical.py:658-678`).
- Mentor context IDs and PII-like email/account patterns return 422. With the provider disabled, prompt-injection text stays in deterministic guided mode and cannot obtain a model/system response.

## Open security risks

1. The labelled browser-local practical demo imports deterministic scoring metadata. A motivated user can inspect or change demo behavior; authenticated evidence remains server-scored. Do not use demo results as credentials or assessment proof.
2. The limiter is per process. Configure an edge/distributed limit and test multi-replica behavior before broad exposure.
3. CSP uses `script-src/style-src 'unsafe-inline'` (`frontend/config/public-environment.ts:106-107`). HSTS, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors 'none'` are present, but nonce/hash migration remains required for stronger XSS containment.
4. Live Supabase token revocation, administrator role assignment, central log redaction/retention, and hosted edge controls were not verified.

## Supply chain and secrets

- `npm audit --omit=dev` and the full audit both reported zero vulnerabilities. No direct Git dependency exists. Three transitive packages declare install scripts: macOS-only `fsevents` copies and `unrs-resolver`; npm 11 reported the latter as pending explicit install-script approval. Production audit remains clean.
- `uv pip check` found 43 compatible packages; runtime and dev requirements are exactly pinned. `pip-audit` repeatedly timed out against its external advisory/resolution services, including the pinned no-deps attempt, so Python CVE status is unverified rather than declared clean.
- Worktree credential-pattern scan found zero files. The pinned Gitleaks history scan is required on the final report commit.

## Reproduction

Run the commands in `SMOKE_TEST_REPORT.md`, then exercise the adversarial cases in `backend/tests/test_security_hardening.py`, `backend/tests/test_practical_finance.py`, and `backend/tests/integration/test_postgres_academy.py`.
