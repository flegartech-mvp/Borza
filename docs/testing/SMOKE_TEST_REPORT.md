# Smoke test report

Assessment: 2026-08-02. Branch: `test/full-platform-hardening`. Code-under-test commit: `d320eee` (preceded by backend commit `8495a6a`). Baseline: `64cf916d626ceb585bd996a14a823315cd96b57e`.

## Environment

- Windows/PowerShell, Node 24.18.0, npm 11.16.0, Python 3.12.13 venv, Docker 29.6.2 / Compose 5.3.1.
- Isolated Compose project `borza-hardening-runtime`: frontend `3210`, API `8100`, PostgreSQL 16 `55432`.
- An unrelated existing `borza-ui-baseline` Compose project was observed and left untouched.
- Test data used synthetic UUIDs, aliases, contacts, and credentials only.

## Command/results

| Gate | Result |
| --- | --- |
| `python scripts/validate_academy_content.py` | PASS: 12 paths, 24 modules, 32 lessons, 108 questions, 118 glossary/review items and all practical collections |
| `python -m unittest scripts.test_validate_academy_content` | 7 passed |
| Backend Ruff format/check + mypy | PASS; 65 files formatted, 40 source files typed |
| Backend `pytest --cov=app` | 38 passed, 2 PostgreSQL-only skips, 87% coverage |
| Premium safety package `pytest tests -q` | 59 passed, 3 skipped |
| Frontend format/lint/typecheck | PASS |
| Frontend Vitest coverage | 10 files / 37 tests passed; 91.45% statements, 77.47% branches, 96.29% functions, 93.4% lines |
| Strict `next build` | PASS; 37 routes generated |
| Strict production Docker build | PASS; standalone server starts from `/app/frontend` as UID/GID 10001 |
| Desktop production Playwright | 18 passed, 1 mobile-only skip |
| Mobile production Playwright | 19 passed |
| Targeted keyboard and API-failure tests | Desktop/mobile passed |
| `npm audit --omit=dev` and full `npm audit` | 0 vulnerabilities / 0 vulnerabilities |
| Tracked/worktree secret-pattern scan | 0 matching files |
| Pinned Gitleaks Git-history scan | PASS: 20 commits, no leaks |

## Runtime smoke

The three-container production-shaped stack became healthy. `/ready` returned database `ok` and schema `current`; `/` returned 200 with HSTS, CSP, framing, MIME, permissions and referrer headers. Adversarial smoke produced the expected 400 hostile Host, 400 hostile CORS preflight, 403 learner-on-teacher, 404 cross-teacher, 413 oversized body, 422 malformed/extra/PII/invalid calculator input, and 405 unsupported method responses. The public practical payload contained zero prohibited answer/scoring keys.

## Failure evidence and skips

- PostgreSQL stop/start injection changed `/ready` from 200 to 503 and back to 200.
- The frontend retained a usable labelled demo when its Academy API request was aborted.
- A full unfiltered worktree Gitleaks directory scan timed out after five minutes because it traversed generated dependency trees; tracked/worktree patterns were scanned separately, and the pinned Git-history scan passed on the report commit.
- Python `pip-audit` 2.10.0 timed out repeatedly after 184 seconds even with pinned requirements and `--no-deps`; `uv pip check` passed 43 installed packages, but Python advisory status remains externally unverified.
- No hosted staging/production, real Supabase Auth, live mentor provider, backup restore, central logs, or monitoring system was changed or exercised.
