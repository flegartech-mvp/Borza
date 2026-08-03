# Borza Academy professional production-readiness review

**Review date:** 2026-08-03

**Scope:** the extracted workspace at `C:\Users\tinif\Downloads\Borza-main (1)\Borza-main`

**Method:** source inspection, pinned local tooling, isolated Docker/PostgreSQL execution, direct API tests, Chromium desktop/tablet/mobile rendering, automated WCAG scans, dependency/secret/image scans, and current platform documentation. No production service, account, credential, or dataset was used.

> **Publication update:** The review began from an extracted worktree whose local `main` had no commits or remote, which produced the provenance finding recorded below. Before publication, the worktree was attached without overwriting its files to the canonical `flegardev/Borza` history at baseline `34d0296`. The resulting comparison contained only this new report and a Next.js type-reference change produced by the audit browser; a fresh production build restored that generated file to the canonical version. A successful push of this report on top of that history resolves SEC-02 and roadmap item C2 for the published artifact. All other findings and release blockers remain unchanged.

## 1. Executive verdict

Borza Academy is a German-first finance-learning application with structured lessons, quizzes, spaced review, deterministic paper-trading simulations, practical-life decision exercises, scam-awareness content, journals, calculators, and anonymous teacher-led classroom sessions. Its strongest intended audience is teachers and finance/economics learners in German- and Slovenian-speaking school or early-university settings; self-directed beginners are a credible secondary audience.

**Classification: strong MVP, not production-ready.** It is substantially better than a typical student project: the design is polished, the backend ownership boundaries are serious, the content is versioned and validated, and the deterministic simulator has a defensible education-first philosophy. It is not yet a production product because the reviewed artifact has no Git provenance, the final images currently scan with critical/high vulnerabilities, private browser flows have never been exercised against real Supabase Auth, rate limiting is not reliable behind the declared Render topology, backup/restore and monitoring are unproved, and several visible product promises are inaccurate or nonfunctional.

**Overall score: 7.0/10.** This score describes engineering and product quality, not deployment approval.

| Area             |  Score | Verdict                                                                                                                                                                                      |
| ---------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend          | 8.5/10 | Strong ownership, decimal arithmetic, migrations, deterministic engines, and tests; authentication latency and list-query patterns need work.                                                |
| Frontend         | 7.2/10 | Broad, coherent implementation with good states and real responsive behavior; too client-heavy, several oversized modules, unchecked API casts, and no real authenticated E2E.               |
| UI/UX            | 8.0/10 | Premium, calm, and unusually consistent; navigation and long-form screens are dense, while the catalogue makes false availability claims.                                                    |
| Security         | 6.7/10 | Good application boundaries and defaults; image CVEs, proxy/rate-limit uncertainty, CSP weakness, and incomplete privacy operations block approval.                                          |
| Testing          | 7.6/10 | Excellent local breadth for an MVP; headline frontend coverage is narrow and browser tests intentionally avoid the real backend/auth stack.                                                  |
| Performance      | 6.8/10 | Local Web Vitals pass; public content is uncached, initial JS is material, auth performs remote verification plus a write per request, and two N+1 paths are confirmed.                      |
| DevOps           | 5.5/10 | Reproducible containers, health checks, migrations, and CI exist; provenance, immutable actions/bases, image/Python scans, observability, restore proof, and promotion evidence are missing. |
| Product strategy | 6.7/10 | Teacher-led financial decision practice is a real wedge; twelve paths, AI branding, generic gamification, and a premium trading-bot wrapper dilute it.                                       |

The strongest parts are the deterministic simulator/risk-discipline model, content validation, private-row ownership enforcement, visual system, and teacher/classroom concept. The weakest parts are operational readiness, genuine end-to-end authentication evidence, performance architecture around authenticated requests, catalogue honesty, and product focus.

### Repository map

```text
Borza-main/
├─ frontend/                  Next.js 16 / React 19 application
│  ├─ app/                    App Router routes and layouts
│  ├─ features/               Academy, simulator, tools, practical finance, auth, marketing
│  ├─ components/             Shared UI and responsive application shell
│  ├─ i18n/                   Typed DE/SL/EN application dictionaries
│  ├─ e2e/                    Playwright demo/failure/accessibility journeys
│  └─ scripts/                Local performance-budget runner
├─ backend/                   FastAPI / SQLAlchemy / Alembic service
│  ├─ app/api/routes/         Public catalogue and owner-scoped APIs
│  ├─ app/services/           Simulator, scoring, mentor, schema, learning engines
│  ├─ app/models/             PostgreSQL/SQLite Academy data model
│  ├─ alembic/                15 immutable migrations
│  └─ tests/                  Unit/security plus narrow PostgreSQL integration tests
├─ content/academy/           Version-controlled curriculum and deterministic scenarios
├─ premium/ai-trading-bot/    Packaging policy/wrappers/tests only; no bot implementation
├─ docs/                      Architecture, privacy, deployment, testing, and runbooks
├─ .github/workflows/ci.yml   CI, gitleaks, backend/frontend/browser/container gates
├─ docker-compose*.yml        Local PostgreSQL, migrations, API, frontend, integration QA
└─ render.yaml                Manual Render backend deployment definition
```

### Actual architecture and data flow

```text
Browser
  ├─ public/anonymous: Next client components -> FastAPI public content -> versioned JSON
  ├─ demo:             React contexts -> browser localStorage -> deterministic client engines
  └─ authenticated:    Supabase browser session -> Authorization bearer token
                                              -> FastAPI
                                                  -> Supabase /auth/v1/user on every request
                                                  -> local User upsert/last_seen commit
                                                  -> owner-scoped SQLAlchemy query
                                                  -> PostgreSQL (Supabase-compatible)

Deployment intent: Vercel frontend -> public Render FastAPI -> Supabase PostgreSQL/Auth
```

State management is React Query plus focused React contexts. Stable authored curriculum lives in JSON; authenticated learner state lives in PostgreSQL; demo notes, journal data, and progress live in `localStorage`. The premium package is not imported by either runtime.

## 2. Verified execution results

### Verified by execution

#### Environment and repository

| Command                                    | Result                                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short --branch`              | **Finding:** `No commits yet on main`; every source path is untracked.                                                                                                             |
| `git log --oneline --decorate -5`          | **Failed as expected:** current branch has no commits. No remote or tags were present.                                                                                             |
| `node --version`; `npm --version`          | **Passed:** Node `v24.18.0`, npm `11.16.0` on host; final image used Node `v24.18.1`.                                                                                              |
| `python --version`                         | Host is Python `3.14.6`; authoritative backend checks used the pinned Python 3.12 container.                                                                                       |
| `docker version`; `docker compose version` | **Passed after Docker Desktop was started:** Docker Engine `29.6.2`, Compose `5.3.1`. The first backend build attempt failed only because the Docker engine was initially stopped. |

#### Frontend

| Command                                                                                                      | Result                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                                                     | **Passed:** 480 packages installed from `package-lock.json` in 44.7 s; npm reported 0 vulnerabilities. npm warned that `unrs-resolver@1.12.2` has an install script.                                    |
| `npm run format:check`                                                                                       | **Passed.**                                                                                                                                                                                             |
| `npm run lint`                                                                                               | **Passed.**                                                                                                                                                                                             |
| `npm run typecheck`                                                                                          | **Passed.**                                                                                                                                                                                             |
| `npm run test:coverage`                                                                                      | **Passed:** 10 test files, 37 tests. 91.45% statements, 77.47% branches, 96.29% functions, 93.40% lines across only 11 selected UI/engine files.                                                        |
| `$env:BORZA_STRICT_PUBLIC_ENV='true'; $env:NEXT_PUBLIC_API_URL='https://api.example.invalid'; npm run build` | **Passed:** strict production build, 37 routes. The placeholder proves configuration validation/buildability, not a real deployment.                                                                    |
| `npx playwright install chromium`                                                                            | **Passed.**                                                                                                                                                                                             |
| `npm run test:e2e`                                                                                           | **Passed:** 39 tests; 1 intentional desktop skip for the mobile-only navigation contract. Desktop Chrome and Pixel 7 projects only.                                                                     |
| `$env:PLAYWRIGHT_TEST_BASE_URL='http://127.0.0.1:3210'; npm run test:performance`                            | **Passed:** all 9 navigations within budgets. Cold JS was 416,850 B (`/`), 603,946 B (`/learn`), and 677,169 B (lesson); cold LCP 340/132/180 ms; `/learn` CLS 0.08454. Local, headless, no throttling. |
| `npm audit --omit=dev`                                                                                       | **Passed:** 0 known vulnerabilities.                                                                                                                                                                    |
| `npm audit`                                                                                                  | **Passed:** 0 known vulnerabilities in the lockfile dependency graph.                                                                                                                                   |
| `docker build --file frontend/Dockerfile ... .`                                                              | **Passed:** standalone, non-root runtime image; live container health check passed.                                                                                                                     |

The high percentage in `test:coverage` must not be interpreted as broad frontend coverage. `frontend/coverage/coverage-summary.json` contains shared UI primitives plus the simulator, review, practical, and calculator pure engines. It excludes the 1,197-line simulator page, 738-line finance-tools page, 651-line workspace provider, 640-line quiz page, 600-line teacher dashboard, auth, API client, query retry policy, and most route behavior.

#### Backend, content, database, premium package, and containers

| Command                                                                                                                                       | Result                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python scripts\validate_academy_content.py`                                                                                                  | **Passed:** 12 paths, 4 active, 24 modules, 32 lessons, 108 questions, 118 glossary terms/review cards, 12 chart exercises, 10 calculators, 10 scenarios, 11 decision cases, 8 scams, 6 classroom activities, 6 life profiles, 8 rounds, 13 competences.               |
| `python -m unittest scripts.test_validate_academy_content`                                                                                    | **Passed:** 7 tests.                                                                                                                                                                                                                                                   |
| `docker compose -f docker-compose.yml config --quiet` and merged QA/test variants                                                             | **Passed.**                                                                                                                                                                                                                                                            |
| `docker build --file backend/Dockerfile --tag borza-academy-backend-audit:20260803 .`                                                         | **Passed:** Python 3.12 non-root image.                                                                                                                                                                                                                                |
| `ruff format --check .`                                                                                                                       | **Passed:** 65 files formatted.                                                                                                                                                                                                                                        |
| `ruff check .`                                                                                                                                | **Passed.**                                                                                                                                                                                                                                                            |
| `mypy app`                                                                                                                                    | **Passed:** 40 files, zero issues.                                                                                                                                                                                                                                     |
| `pytest --cov=app --cov-report=term-missing`                                                                                                  | **Passed:** 38 tests, 2 PostgreSQL-only skips, 87% backend coverage. Starlette emitted one TestClient/httpx deprecation warning.                                                                                                                                       |
| Premium tests on a read-only source bind                                                                                                      | **Audit-harness failure:** 5 tests passed and 57 setup errors because pytest could not create `.pytest-temp` on a read-only mount. No product assertion failed.                                                                                                        |
| Premium tests from a disposable tmpfs copy: `pytest tests -q`                                                                                 | **Passed:** 61 tests, 1 expected platform skip.                                                                                                                                                                                                                        |
| Isolated PostgreSQL migration/integration profile (`alembic upgrade head`; `alembic current`; `alembic check`; `pytest tests/integration -q`) | **Passed:** schema at `0015 (head)`, no new upgrade operations, 2 integration tests passed.                                                                                                                                                                            |
| `docker run ... pip-audit==2.9.0 ... -r /requirements.txt`                                                                                    | **Passed:** no known Python dependency vulnerabilities.                                                                                                                                                                                                                |
| Source-only Gitleaks directory scan using the CI-pinned `v8.30.1` image                                                                       | **Expected nonzero:** exactly 7 redacted, intentional synthetic credential fixtures, all in `premium/ai-trading-bot/tests/test_package_bot.py`; no other finding. The initial whole-workspace scan was stopped because it entered generated dependencies/build output. |
| Docker Scout, backend final image                                                                                                             | **Failed release gate:** 2 critical + 2 high findings in Debian Perl `5.40.1-6` (`CVE-2026-13221`, `CVE-2026-12087`, `CVE-2026-48959`, `CVE-2026-48962`).                                                                                                              |
| Docker Scout, frontend final image                                                                                                            | **Failed release gate:** 1 critical + 4 high findings in the globally bundled npm CLI (`tar@7.5.15`, `brace-expansion@5.0.6`, `undici@6.26.0`).                                                                                                                        |

#### Isolated full-stack behavior

The stack used a unique Compose project, PostgreSQL on `55432`, FastAPI on `8100`, and Next.js on `3210`. All four services were healthy. Migrations ran before the API. `/live`, `/ready`, `/api/v1/catalog`, `/`, and `/learn` returned 200.

Direct API tests used disposable demo UUIDs accepted only because the backend ran with `ENVIRONMENT=test` and `ACADEMY_ALLOW_DEMO_AUTH=true`:

| Flow                                                             | Result                                                                                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Unauthenticated dashboard                                        | 401.                                                                                                                                          |
| Onboarding                                                       | 200; persisted; correctly recommended Risk Management.                                                                                        |
| Lesson completion                                                | 200; returned `completed`, 100%.                                                                                                              |
| Quiz submission                                                  | 200; 3/3, 100%. An initial 422 was caused by the audit request using the wrong answer envelope and passed after matching the public contract. |
| Lesson note: owner vs second user                                | Owner write 200; other user read 404.                                                                                                         |
| Simulator create, deterministic 100-candle step, results         | 201/200/200; final index 47, process score 100, net P&L zero for a disciplined no-trade run.                                                  |
| Simulator second-user read                                       | 404.                                                                                                                                          |
| Journal create/list/second-user read                             | 201/200/404.                                                                                                                                  |
| Mentor prompt-injection string                                   | 200, safe `guided_fallback`; no provider was enabled.                                                                                         |
| Mentor email/PII input                                           | 422.                                                                                                                                          |
| Teacher classroom create, anonymous join, owner dashboard, close | 201/200/200/200.                                                                                                                              |
| Other teacher dashboard access                                   | 404.                                                                                                                                          |
| Join after close                                                 | 404.                                                                                                                                          |
| Deliberately mismatched classroom type/content                   | **Defect reproduced:** 201; `scam_detector` was stored for the `life-budget-choices` content item.                                            |

This proves the backend persistence and ownership boundaries under PostgreSQL. It does **not** prove Supabase sign-in or an authenticated browser flow.

#### Browser, responsiveness, states, and accessibility

The real production frontend container was opened in Chromium against the real public FastAPI catalogue. Private activity remained explicitly labelled browser-local demo because no real Supabase project was configured.

- Manually rendered landing, sign-in, onboarding, Learn, lesson, settings, simulator, tools, journal, teacher dashboard, life simulator, AI mentor, and a missing URL.
- Checked 1440 px desktop, 768 x 1024 tablet, and 390 x 844 mobile; light and dark themes; English and Slovenian manually. The automated suite also exercises German, locale persistence, mobile navigation, direct URLs, refresh, unavailable-API fallback, and horizontal overflow.
- The first Tab focused the visible skip link; Enter moved focus to `main#academy-content`.
- Axe ran WCAG 2.0/2.1/2.2 A/AA plus best-practice rules across the core and practical route lists in both Playwright projects; no automated violations were reported.
- A deliberately missing route returned a correct HTTP 404 but only the generic English Next page, with no recovery link or Academy shell.
- Browser console checks across 13 primary routes found no page/console errors. Manual sessions observed only a repeated unused-preloaded-CSS warning on settings; the missing page logged the expected 404 resource error.

Meaningful audit screenshots are retained under `frontend/output/playwright/borza-audit/.playwright-cli/`. Examples include Learn desktop/mobile/tablet, settings light/dark, Slovenian life simulator, generic 404, simulator, finance tools, journal, teacher dashboard, and mentor. These are generated audit artifacts and intentionally ignored by Git.

#### Cleanup

The first `docker compose ... down` attempt stopped before mutation because `POSTGRES_PASSWORD` interpolation was absent. The containers and volume were then identified through `com.docker.compose.project=borza-audit-20260803`, a fresh local-only placeholder satisfied interpolation, and the exact project was removed with:

```powershell
docker compose --project-name borza-audit-20260803 `
  -f docker-compose.yml -f docker-compose.hardening.yml `
  down --volumes --remove-orphans
```

The four audit containers, audit network, and `borza-audit-20260803_postgres_data` were removed. Post-cleanup label queries returned no container or volume. The audit images and unrelated Docker state were left untouched.

### Verified by static inspection

- Next.js 16.2.12, React 19.2.4, TypeScript 5.7, React Query 5, Supabase SSR/client, React Hook Form, Zod 4, lightweight-charts 5, KaTeX, and FSRS.
- FastAPI 0.140.3, Uvicorn 0.51.0, SQLAlchemy 2.0.51, Alembic 1.18.5, Psycopg 3.3.4, PostgreSQL/SQLite support.
- Server-only OpenAI Responses API call, strict JSON schema, `store: false`, HMAC safety identifier, bounded output, and fallback behavior.
- No runtime import from `premium/ai-trading-bot`; no file-upload surface; no service-role key in frontend code; no broker/order transmission.
- CORS, trusted hosts, schema-state startup verification, private response no-store headers, and non-root containers are implemented.

### Not verified

- Any current live Vercel, Render, Supabase, custom-domain, DNS, TLS, or production database state.
- Real Supabase sign-up/sign-in/reset, token refresh/revocation, role assignment, email delivery, or an authenticated browser journey.
- Hosted migration/grant state, production RLS advisors, backup restoration, point-in-time recovery, rollback, or retention-job scheduling.
- Actual Render proxy headers in a deployed request. Current Render/Uvicorn documentation was used to assess the configuration.
- A real OpenAI response, malformed provider output, provider cost, or moderation behavior; the feature remained disabled and no key was supplied.
- Firefox, WebKit/Safari, real screen readers, voice control, switch access, or institutional assistive-technology testing.
- Hosted Web Vitals/RUM, INP, realistic mobile networks, multi-instance load, sustained concurrency, database plans, or production SLOs.
- A clean CI run from this artifact: there is no commit, and the current `.gitleaksignore` fingerprints name a historical commit that is absent here.

## 3. Code-quality review

### Confirmed defects and maintainability findings

| Priority | Finding                                                                             | Evidence and consequence                                                                                                                                                                                                                                                                            | Exact fix                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Planned paths are presented as available and actionable.                            | `frontend/features/academy/catalog.tsx:54-100` ignores `path.status`, labels every non-flagship path “Available,” and renders “Open path.” Eight cards have zero lessons. This is visible deception, not polish.                                                                                    | Filter planned paths from the primary grid or render a disabled “Planned” state from `status`; do not link to empty paths. Add a status regression test.                               |
| Medium   | Classroom activity type is not matched to authored content.                         | `backend/app/api/routes/practical.py:421-435` checks ID and version but persists the request type without comparing it to `activity.kind`. A mismatched request returned 201.                                                                                                                       | Canonicalize content/request enum values, compare kind/type before insert, return 422, and add an integration test.                                                                    |
| Medium   | The explicit Reduce Motion setting is nonfunctional.                                | `frontend/features/secondary/settings-page.tsx:68-90` sets `data-reduce-motion`; no CSS or component consumes it. Auth preferences are not applied on query load, and demo choice is not persisted. OS `prefers-reduced-motion` support at `frontend/app/globals.css:223-230` is good but separate. | Apply the preference in a root effect/bootstrap, persist demo choice, and add `[data-reduce-motion="true"]` rules plus a Playwright animation-duration assertion.                      |
| Medium   | Email reminders are exposed without any delivery system.                            | `frontend/features/secondary/settings-page.tsx:135-144` enables the authenticated checkbox; backend only stores the preference. No mail sender, schedule, or job exists.                                                                                                                            | Hide/disable it as “not available” until an actual consent/unsubscribe/delivery flow exists, or implement and monitor the complete service.                                            |
| Medium   | Query retry classification is wired to a nonexistent error shape.                   | `frontend/features/query/query-provider.tsx:18-23` reads `error.problem.status`; `AcademyApiError` exposes `status` directly at `frontend/lib/api-client.ts:4-12`. Many hooks additionally set `retry: 1`, forcing a retry even on 401/403/404/422.                                                 | Use `error instanceof AcademyApiError ? error.status : undefined`, centralize policy, remove numeric overrides, and test 401/404/429/500/network cases.                                |
| Medium   | Backend response types are duplicated and runtime-unchecked.                        | `frontend/features/academy/use-academy-content.ts:23-110` handwrites API types; `frontend/lib/api-client.ts:64-79` casts arbitrary JSON to `T`. Similar response shapes occur in the 651-line workspace provider.                                                                                   | Generate types from FastAPI OpenAPI or maintain shared Zod schemas; parse at the API boundary and surface a contract error rather than silently falling back.                          |
| Medium   | Authenticated workspace hydration fans out expensive requests.                      | `frontend/features/demo/demo-workspace-provider.tsx:345-351` sends dashboard, progress, bookmarks, and a 100-entry journal request in parallel. Each incurs Supabase verification and a user-row commit.                                                                                            | Add one purpose-built bootstrap endpoint or optimize auth first; return only recent journal metadata and lazy-load full entries.                                                       |
| Medium   | Browser/server finance logic duplicates four formulas with different number models. | Browser calculations are in `frontend/features/tools/calculators.ts:1546-1767` using JS `number`; four unused API equivalents use backend `Decimal` in `backend/app/api/routes/calculators.py:28-63`. No cross-runtime parity fixture exists.                                                       | Choose one source of truth. For offline educational tools, keep the tested client engine and remove unused APIs; otherwise call the Decimal API. In either case share golden fixtures. |
| Low      | Catalogue numbering renders `010`, `011`, `012`.                                    | `frontend/features/academy/catalog.tsx:59-62` prefixes `0` instead of padding.                                                                                                                                                                                                                      | `String(index + 1).padStart(2, "0")`.                                                                                                                                                  |
| Low      | Error/loading/not-found experiences violate the locale and visual system.           | `frontend/app/error.tsx:12-18` and `frontend/app/loading.tsx:5-17` are hard-coded English; no `app/not-found.tsx` exists. The rendered 404 is generic English.                                                                                                                                      | Add localized route-state components and an Academy recovery link; test each locale.                                                                                                   |
| Low      | Workspace routes expose two H1 elements.                                            | `frontend/components/shell/workspace-header.tsx:22-24` uses H1, and every `PageHeading` uses H1 at `frontend/components/academy/page-heading.tsx:22-24`. Rendered settings confirmed both.                                                                                                          | Make the persistent header label a non-heading or ensure only the page content owns H1.                                                                                                |

### Oversized modules and concrete split

The issue is not line count alone; these files mix data contracts, state machines, network mutations, localization, and presentation:

| Current file                                       | Lines | Recommended modules                                                                                                                                                          |
| -------------------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/tools/calculators.ts`                    | 1,779 | `definitions/trading.ts`, `definitions/finance.ts`, `engine/parse.ts`, `engine/evaluate.ts`, `engine/format.ts`, `copy/*.ts`, shared fixtures.                               |
| `features/simulator/simulator.tsx`                 | 1,197 | `use-simulator-session.ts`, `remote-simulator-api.ts`, `ReplayChart.tsx`, `ReplayControls.tsx`, `RiskPlan.tsx`, `OrderTicket.tsx`, `AccountMetrics.tsx`, `ProcessScore.tsx`. |
| `i18n/dictionaries.ts`                             | 1,055 | Namespace dictionaries (`shell`, `academy`, `journal`, `auth`) with one compile-time aggregate and missing-key test.                                                         |
| `features/tools/finance-tools.tsx`                 |   738 | `ToolNavigator`, `CalculatorForm`, `InputField`, `ResultPanel`, `FormulaPanel`, and `useCalculator`.                                                                         |
| `features/demo/demo-workspace-provider.tsx`        |   651 | `demo-storage.ts`, `workspace-api.ts`, `workspace-mappers.ts`, domain action hooks, thin provider. Runtime-validate storage before accepting it.                             |
| `features/academy/quiz-page.tsx`                   |   640 | Question renderers by type, `useQuizAttempt`, navigation/progress, and results/feedback.                                                                                     |
| `features/practical-finance/teacher-dashboard.tsx` |   600 | `CreateClassroom`, `SessionList`, `SessionOverview`, `AggregateDashboard`, `ReportActions`, and remote/demo adapter.                                                         |

The split should preserve behavior and land with tests; it should not become a framework rewrite.

## 4. Architecture review

### Frontend

The App Router structure is understandable, but the application renders most public education content through client components and React Query. `frontend/app/layout.tsx:40-44` wraps even the marketing site in Query, Auth, and DemoWorkspace providers. That makes the public landing page pay for application state it does not use and contributes to a 416,850-byte cold JS transfer. Move Query/Auth/DemoWorkspace to the Academy/auth route groups; keep only language/theme bootstrap global.

Public paths and lessons are ideal server-render/cache candidates. Today `frontend/features/academy/use-academy-content.ts:228-315` fetches after hydration and replaces fallback content. The measured `/learn` CLS of 0.08454 came from this swap. Fetch versioned public content in server components, cache by content version/ETag, and hydrate only interactive controls. Keep the chart client-only dynamic import in `frontend/features/charts/chart-loader.tsx:7-12`; that boundary is correct.

The demo mode is clearly labelled and useful, but it is acting as both product demo and fallback architecture. `frontend/features/demo/demo-workspace-provider.tsx:22-96` stores notes, journal entries, and simulator summaries in localStorage. The provider exposes `resetDemo` at lines 595-616, but no component consumes it. A user cannot clear potentially personal demo notes from the application. Add a visible, confirmed “Clear data on this device” action and a concise shared-device warning near journal/note entry.

### Backend and API

The API is cohesive: synchronous FastAPI routes, SQLAlchemy sessions, versioned content registry, and PostgreSQL. There is no needless worker/cache/microservice layer. Schema mutation is correctly isolated to Alembic; startup checks head state at `backend/app/main.py:29-33`.

Ownership is consistently expressed in queries and was validated across notes, simulator, journal, and teacher sessions. Role authorization is server-side (`backend/app/api/deps/auth.py:127-132`). CORS does not allow credentials, and the API expects bearer headers, so classical cookie-CSRF is not the primary threat.

The main scalability fault is authentication work. `backend/app/api/deps/auth.py:24-63` performs a synchronous remote Supabase `/auth/v1/user` call for every private request. Lines 106-123 then write/commit/refresh `last_seen_at` for every request. Initial workspace hydration alone creates four remote identity checks and four database commits. Prefer local JWT verification against cached Supabase JWKS with issuer/audience/expiry checks, short token lifetime, and selective remote checks for sensitive actions/revocation requirements. Throttle `last_seen_at` updates to, for example, once per 15 minutes with a conditional update.

### Database, caching, and query behavior

The data model and migrations are stronger than the delivery layer. Confirmed list inefficiencies are:

- Simulator history: `backend/app/api/routes/simulator.py:38-62` loads orders and trades separately, and `list_sessions` at lines 101-115 calls it per row. A 20-item response therefore issues 1 session query + 40 child queries before auth overhead, returns every visible candle for every session, and has no cursor. Measured locally: 81,377 bytes and 97.7 ms.
- Journal: `_read` at `backend/app/api/routes/journal.py:73-91` queries tags separately; list lines 124-146 execute count + list + one tag query per entry. Measured locally at 20 items: 12,532 bytes and 46.3 ms before network/auth latency. The frontend asks for 100 entries during initial hydration.
- Classroom dashboard: `backend/app/api/routes/practical.py:481-518` materializes all participants and responses in Python. It is acceptable for a small pilot but needs a documented class-size ceiling or SQL aggregates/pagination.
- Public responses have no cache header. `/api/v1/catalog` returned `Cache-Control: <absent>` while private dashboard correctly returned `private, no-store`. Meanwhile every frontend request is forced to `cache: "no-store"` at `frontend/lib/api-client.ts:47-55`.

Fix the N+1 queries with grouped joins/select-in loading and response-specific projections. A simulator list should return summary rows, not candle/order/trade histories; load details by ID. Add cursor/offset pagination to simulator history and use the existing journal offset deliberately. Add `ETag`/`Cache-Control: public` for versioned public content and stop forcing no-store for GETs that are safe to cache.

## 5. Security report

No application-level critical data disclosure or authentication bypass was found. The critical rating below comes from the actual final container scan and is a release-policy blocker even though the identified packages appear unreachable from normal Academy request paths.

### Critical

#### SEC-01 — Final runtime images contain critical and high CVEs

- **Location:** `backend/Dockerfile:1,30`; `frontend/Dockerfile:1,6,24`; floating `python:3.12-slim` and `node:24-alpine` bases.
- **Evidence:** backend digest `fe00b17...` contains Perl `5.40.1-6` with 2 critical/2 high findings, currently reported as not fixed. Frontend digest `145f807...` contains global npm CLI dependencies with 1 critical/4 high; `tar@7.5.15` has fixed releases, and `brace-expansion`/`undici` also have fixes.
- **Scenario:** the application does not invoke Perl, npm, tar, glob expansion, or an Undici WebSocket client during ordinary requests, so direct reachability is low. Keeping unnecessary vulnerable interpreters/package managers in production nevertheless expands the attack surface and fails a defensible image gate.
- **Likelihood:** low through normal routes; higher through a future operational/debug path or package use.
- **Impact:** scanner-rated critical/high availability or code-execution classes; production compliance and incident triage are immediately affected.
- **Fix:** rebuild on explicit patched/minimal bases; remove npm and package-manager tooling from the final Node image or use a compatible minimal/distroless runtime; select a Python base without the vulnerable unused Perl package; pin base digests and rescan. Do not suppress by CVE ID without reachability evidence and an expiry date.
- **Blocks production:** **yes**.

### High

#### SEC-02 — The reviewed release artifact has no verifiable Git provenance

- **Location:** repository metadata, `.gitleaksignore:1-9`, `.github/workflows/ci.yml:11-22`.
- **Evidence:** `main` has no commits; no remote or tags exist; every source file is untracked. Gitleaks ignores refer to historical commit `a29f...`, so they will not match the same synthetic fixtures in a newly created root commit.
- **Scenario:** the exact reviewed bytes cannot be tied to a reviewed commit, protected branch, CI run, archive tag, or deployment. A fresh commit would also fail secret scanning unless the intentional fixtures are handled in a stable, narrowly scoped configuration.
- **Likelihood:** certain for this extracted artifact; the canonical repository may exist elsewhere but was not supplied.
- **Impact:** release reproducibility, change review, rollback, and supply-chain evidence are invalidated.
- **Fix:** restore the canonical Git repository/history; compare this tree byte-for-byte; commit only after resolving the fixture allowlist with path/rule-scoped test allowances; require a clean CI run on the exact release SHA and attach SBOM/image scan evidence.
- **Blocks production:** **yes** for this artifact.

### Medium

#### SEC-03 — Application rate limiting does not have a trustworthy Render client identity and is not shared

- **Location:** `backend/app/core/rate_limiter.py:10-45,74-90`; `render.yaml:9` starts two Uvicorn workers.
- **Evidence:** limits are in-memory per process and keyed by `request.client.host`. Render’s current documentation says an app sees the proxy IP by default and must account for `X-Forwarded-For`; Uvicorn trusts forwarded headers only from `FORWARDED_ALLOW_IPS` (default `127.0.0.1`). The Render command does not configure trusted proxies. Two workers also maintain separate counters.
- **Scenario:** many clients can collapse onto a proxy identity and deny service to each other, or traffic can be split across proxies/workers and exceed intended classroom/mentor limits. Blindly trusting a client-supplied `X-Forwarded-For` would create spoofing instead.
- **Likelihood:** high once deployed behind the declared proxy; exact behavior was not live-observed.
- **Impact:** classroom join reliability, brute-force controls, partner-form abuse, and AI cost control.
- **Fix:** validate the actual Render header chain in staging; configure Uvicorn’s trusted proxy boundary for the platform topology; use Render edge/firewall limits or a shared distributed limiter for sensitive endpoints; key authenticated AI limits by user plus IP; retain a global budget/circuit breaker. Record `Rndr-Id`/CF tracing, not raw untrusted headers.
- **Blocks production:** **yes** until the edge control is evidenced.

#### SEC-04 — Privacy lifecycle is incomplete for learner and demo data

- **Location:** demo storage `frontend/features/demo/demo-workspace-provider.tsx:22-96,595-616`; retention docs `docs/CLASSROOM_PRIVACY.md:9-11`; only item deletes at `backend/app/api/routes/journal.py:298` and `backend/app/api/routes/learning.py:167`.
- **Evidence:** demo notes and journals are plaintext browser storage; the clear function has no UI consumer. There is no account export or account deletion endpoint. Classroom/partnership deletion requires an unscheduled operator CLI. General learner records have no documented retention lifecycle.
- **Scenario:** personal finance notes remain on a shared device, or a user/school requests export/erasure and operators cannot execute a complete, auditable workflow. Restored backups may reintroduce deleted data.
- **Likelihood:** medium for public users; high for a school pilot.
- **Impact:** privacy harm and inability to meet institutional/legal obligations.
- **Fix:** add local clear/export controls; publish the demo-storage warning; implement authenticated export and deletion/closure workflows; schedule and monitor retention; document backup reconciliation, legal basis, guardian/student notice, and incident ownership.
- **Blocks production:** public launch **yes** for privacy operations; school deployment **yes**.

#### SEC-05 — CSP still permits arbitrary inline script execution

- **Location:** `frontend/config/public-environment.ts:100-115`; inline bootstrap at `frontend/app/layout.tsx:33-37`.
- **Evidence:** production policy contains `script-src 'self' 'unsafe-inline'`; style also permits inline. The only reviewed `dangerouslySetInnerHTML` script is a version-controlled preference bootstrap, and formula HTML at `frontend/features/tools/finance-tools.tsx:183-189` is static KaTeX output, not user input.
- **Scenario:** a future HTML injection has a much easier path to executing script and stealing the browser-accessible Supabase session.
- **Likelihood:** low today; rises with product growth.
- **Impact:** account/session compromise through XSS.
- **Fix:** hash or nonce the preference bootstrap, remove script `unsafe-inline`, keep `object-src none`, and add CSP violation reporting in report-only mode before enforcement. Evaluate style nonces separately.
- **Blocks production:** not alone, but required security hardening before a broad public launch.

#### SEC-06 — AI Mentor needs per-user cost/privacy/output controls before enablement

- **Location:** PII patterns `backend/app/api/routes/practical.py:87-91,150-152`; provider `backend/app/services/mentor.py:76-161`; limiter `backend/app/core/rate_limiter.py:47-52`.
- **Evidence:** the feature is disabled by default; it uses a bounded system prompt, strict JSON schema, max 500 tokens, timeout, `store: false`, HMAC safety identifier, and safe fallback. PII detection only covers IBAN-like values, email, and 13–19 digit numbers. There is no per-user quota, daily spend cap, moderation step, or post-generation financial-advice validator. The model can return content IDs other than the supplied context because they are not checked.
- **Scenario:** authenticated users automate requests, include names/addresses/phone numbers missed by regex, or obtain a schema-valid but inappropriate recommendation.
- **Likelihood:** none while disabled; medium if enabled publicly.
- **Impact:** cost, privacy, and financial-guidance reputation. The model has no tools, secrets beyond its server call, or order capability, so prompt injection is not critical.
- **Fix:** keep disabled for the pilot or add per-user/IP/global quotas, budget alerts/circuit breaker, broader client/server PII guidance, output policy checks, context-ID equality, audit metrics without prompt content, and adversarial provider tests.
- **Blocks production:** only if AI mode is enabled.

#### SEC-07 — CI supply-chain and vulnerability gates are incomplete

- **Location:** `.github/workflows/ci.yml:11,41-43,82-84`; `docker-compose.yml:3`; Dockerfiles.
- **Evidence:** checkout/setup actions use mutable major tags, PostgreSQL/base images are floating, CI runs only `npm audit --omit=dev`, and has no `pip-audit`, image scan, SBOM, provenance/attestation, or dependency-update policy. The gitleaks image itself is correctly pinned by digest.
- **Scenario:** a moved action tag/base image changes build code, or a vulnerable final image passes because lockfile audits do not inspect global/base packages.
- **Likelihood:** medium.
- **Impact:** compromised CI or release of known vulnerable artifacts.
- **Fix:** pin actions to full commit SHAs, pin base/service image digests with Renovate/Dependabot updates, add full npm + pip + final-image scans and SBOM generation, fail on policy severity with reviewed exceptions, and add job timeouts.
- **Blocks production:** current image scan already blocks; the CI gaps must be closed before sustained releases.

### Low

#### SEC-08 — URL safety helper is unused outside the trusted content boundary

- **Location:** `frontend/lib/safe-url.ts:1-10`; direct anchors in `frontend/features/academy/lesson-page.tsx:384-388` and `frontend/features/practical-finance/life-simulator.tsx:427-444`.
- **Evidence:** authored Academy sources are validated as HTTPS, credential-free, fragment-free, and authority-allowlisted at `scripts/validate_academy_content.py:814-829`. Life-simulator assumption URLs are rendered directly and are not covered by the same validator. The generic helper permits HTTP and has no host policy.
- **Scenario:** a future content edit adds an inappropriate or insecure assumption link.
- **Likelihood:** low because content is version-controlled.
- **Impact:** phishing/reputation, not code execution.
- **Fix:** validate every content URL in the authoring validator, require HTTPS, and define the relevant allowlist. Remove the unused helper or make it the enforced boundary.
- **Blocks production:** no.

### Security positives

- Private data was owner-scoped in every exercised route; cross-user and cross-teacher reads returned 404.
- Demo auth is rejected in deployed environments (`backend/app/api/deps/auth.py:79-84`).
- Teacher roles are derived server-side from trusted Supabase app metadata, not frontend state.
- Classroom codes/tokens are HMAC-hashed at rest; codes use a 32-character unambiguous alphabet, seven random characters, and four-hour expiry (`backend/app/services/practical_engine.py:23-40`; `backend/app/api/routes/practical.py:429-440`).
- Strict host/CORS/body limits, no credentialed CORS, private no-store headers, docs disabled when deployed, decimal money, row ownership, optimistic versions, and non-root runtime users are good.
- No upload surface, real brokerage, client-exposed service key, unsafe SQL construction, or open redirect was found.
- The source scan found no real credential; the seven findings are deliberately adversarial test strings and were redacted.

## 6. UI/UX and accessibility report

### Rendered quality

The landing page genuinely looks premium: strong editorial hierarchy, restrained green/amber finance palette, good type scale, clear responsible-use boundary, and a coherent light/dark system. The simulator is the visual high point: charts, process scoring, deterministic-data explanation, and paper-trading warning feel purposeful rather than casino-like. Onboarding is concise and beginner-friendly. Tablet and mobile layouts reflow correctly, and touch controls are generally at least 40–44 px.

The product becomes less clear inside the workspace:

- The desktop sidebar exposes roughly eighteen destinations. It is a feature inventory, not a prioritized learning journey. Keep 5–7 primary destinations and put glossary, achievements, profile, settings, and secondary labs under contextual or “More” navigation.
- `/learn` is the largest trust failure: eight empty, explicitly planned paths look available. The page is very long on mobile and uses the same visual weight for real and nonexistent curriculum.
- `/journal` opens with a very long form and four large zero-state analytics cards. Group “Plan,” “Execution/emotions,” and “Review” into progressive sections; show analytics after the first entry.
- `/tools` is powerful but its 18-item left rail is cramped. Keep categories, add search, and show recent/favorite tools rather than every item at equal prominence.
- `/simulator` is impressive but intimidating for a beginner. Preserve advanced controls but make the next action explicit: plan risk, place/skip, step, journal, debrief.
- `/teacher/dashboard` has a clear creation card and privacy-respectful aggregate copy, but its proof depends on a real teacher account and live class session, which the browser tests do not cover.
- `/mentor` is visually clear, yet the disabled guided mode provides generic Socratic prompts. Calling that destination “AI Mentor” overstates current value; “Decision Coach” is more honest until AI is enabled and evaluated.

### Localisation defects confirmed in rendered/source output

The typed main dictionary is good, and content validation confirms DE/SL/EN authored fields. Scattered feature-local copy prevents the languages from being first class:

- Slovenian Life Simulator rendered English `/ month`, `liquid`, and `Assumptions`; source at `frontend/features/practical-finance/life-simulator.tsx:265-267,427-429,467-481` also leaves all metric names and accessible label English.
- “Risk is not proof” remains English at `frontend/features/practical-finance/scam-detector.tsx:262-268`.
- Classroom legends “Signals” and “Options” remain English at `frontend/features/practical-finance/classroom-join.tsx:288-300,380-381`.
- Teacher “Sessions” remains English at `frontend/features/practical-finance/teacher-dashboard.tsx:409-412`.
- Impact interest options remain English at `frontend/features/marketing/impact-page.tsx:474-486`; footer links remain English at `frontend/features/marketing/marketing-shell.tsx:121-128`.
- Catalogue degraded text at `frontend/features/academy/catalog.tsx:42-47`, global errors/loading, and the missing page are English regardless of current locale.

Move every user-visible and accessible string into typed namespaces and add a static JSX-string lint/check. Do not rely only on dictionary-key parity.

### Accessibility: confirmed strengths

- Axe WCAG/best-practice scans passed across the broad route sets in both Playwright projects.
- A skip link exists and was manually proven to transfer focus (`frontend/components/shell/app-shell.tsx:25-37`).
- Focus-visible outlines are global and clear (`frontend/app/globals.css:201-210`).
- Native landmarks, labels, fieldsets, live/alert states, semantic buttons, and native `<dialog>` are used consistently.
- OS reduced-motion is respected; skeleton and spinner utilities also disable animation.
- The market chart includes a textual summary and clearly labels simulated data; chart code is dynamically loaded and cleaned up.
- Language changes update `document.documentElement.lang` (`frontend/features/preferences/preferences.ts:35-44`).

### Accessibility: confirmed defects and remaining evidence gaps

1. The explicit reduced-motion preference does nothing, as described in the code findings. This is a real defect, not a theoretical concern.
2. Duplicate H1 elements occur throughout the workspace. Axe permits this, but it creates unnecessary screen-reader heading noise.
3. Mixed-language visible text and accessible labels are confirmed in Slovenian. Automated scans cannot detect incorrect language.
4. The generic English 404 provides no localized recovery path.
5. Manual keyboard evidence covered focus entry, skip navigation, labelled theme controls, and normal form traversal only. There is no VoiceOver/NVDA/JAWS, speech, switch, zoom/reflow-at-400%, or classroom-projector/AT evidence. School approval requires those tests with German and Slovenian users.

## 7. Product review

The real strategic opportunity is **teacher-led, evidence-based financial decision practice**, supported by a disciplined learner curriculum. Schools have a clearer unmet need and acquisition channel than generic retail traders; the anonymous classroom model, process-over-P&L scoring, scam cases, life simulator, and localized material combine into a differentiated pilot. Risk Management should remain the flagship path and prerequisite.

The application is currently trying to present five products at once: course platform, paper-trading terminal, personal-finance simulator, teacher platform, and AI coach. The premium bot adds a sixth brand association even though it is not integrated. This breadth weakens the promise.

Recommended positioning:

> Borza Academy helps teachers and learners practise real financial decisions safely, in German and Slovenian, with transparent process-based evidence.

- **Primary:** secondary-school, vocational, and early-university teachers/classes.
- **Secondary:** responsible self-directed finance beginners.
- **Supporting labs:** trading simulator and calculators, attached to lessons rather than equal top-level products.
- **Do not lead with:** AI, trading performance, achievements, or a commercial bot.

Twelve visible learning paths damage trust when only four contain lessons. The four active paths total 32 lessons and 754 authored minutes (about 12.6 hours). Each path has eight lessons and about 3–3.5 hours. Lesson instructional blocks average roughly 124 German, 118 Slovenian, and 131 English words before quiz/glossary/interactive material. The content is thoughtfully structured and well sourced—14 sources from Investor.gov, FINRA, CFTC, ECB, and ESMA—but it is a compact pilot curriculum, not a twelve-path university-scale Academy. Hide the eight roadmap paths from the active catalogue.

The teacher/classroom wedge is stronger than either the simulator or AI Mentor because it links content, facilitation, anonymous participation, and measurable process outcomes. The simulator remains an excellent lab. The AI Mentor is currently optional polish with ongoing cost/privacy risk and should not be the product thesis.

## 8. Testing and reliability

### What the tests genuinely prove

- Backend route/service behavior, security hardening, deterministic engines, content loading, and most local persistence logic are covered under Python 3.12.
- Two PostgreSQL integration tests prove a clean migration and selected PostgreSQL/RLS behavior.
- Content IDs, ordering, prerequisites, translations, references, scenario contracts, and source authorities are extensively validated.
- Pure client engines for calculators, simulator, FSRS review, and practical finance have strong focused tests.
- The browser suite proves broad Chromium route rendering, demo persistence, refresh/direct navigation, responsive layout, failure fallback, console cleanliness, and axe results.
- Dockerfiles build, containers run as non-root users, migrations gate backend startup, and health endpoints work in an isolated PostgreSQL stack.
- Cross-user and cross-teacher boundaries were exercised manually through the real API/database.

### What the tests do not prove

- `frontend/e2e/academy.spec.ts:164-175` intercepts every `/api/v1/**` call and returns 204 so the application uses demo fallback. Therefore the 39 passing browser tests do not prove FastAPI, PostgreSQL, Supabase Auth, remote error contracts, or authenticated persistence.
- The CI browser build also points to `https://api.example.invalid` (`.github/workflows/ci.yml:94-102`).
- There is no real multi-account browser test, teacher-role login, token expiry/revocation test, or Supabase reset-email test.
- Frontend coverage excludes the largest components and important error/retry/auth boundaries.
- There is no OpenAPI client compatibility test, calculator parity suite, image vulnerability gate, or test for classroom kind/type matching.
- Only Chromium is configured (`frontend/playwright.config.ts:16-24`); no Firefox/WebKit.
- Local performance budgets use no network/CPU throttling and a permissive 1.5 MB JS limit (`frontend/scripts/measure-performance.mjs:69-75`). They do not measure INP.
- No restoration drill, retention schedule, deployment rollback, alert exercise, or incident-response rehearsal was executed.

Reliability is high for a local demo and backend API, moderate for an MVP, and unproved for a hosted school/public service.

## 9. Performance review

### Measured local browser performance

These figures are development-machine measurements against a local production build. They are useful regression evidence, not field performance or a Core Web Vitals guarantee.

| Route         | Cold TTFB |     Load |    LCP |      CLS | Transferred JavaScript |
| ------------- | --------: | -------: | -----: | -------: | ---------------------: |
| `/`           |    9.9 ms | 364.3 ms | 340 ms |        0 |              416,850 B |
| `/learn`      |    7.6 ms | 165.8 ms | 132 ms | 0.084542 |              603,946 B |
| lesson detail |   46.1 ms | 217.9 ms | 180 ms | 0.004808 |              677,169 B |

The automated budgets passed, but the run had no CPU/network throttling, no real latency, no cache-warm comparison, and no INP measurement. The `/learn` CLS is caused by client-side demo/content hydration replacing fallback UI and is noticeable even though it remains below the current 0.1 budget.

### Frontend bottlenecks

1. `frontend/app/layout.tsx:40-44` puts Query, Auth, and Demo providers around the entire application, including marketing pages. Public content should render without account/workspace state.
2. `frontend/proxy.ts:4-28` performs a Supabase `getUser()` check across almost every matched page, including public routes. Narrow the matcher or split public and authenticated layouts.
3. `frontend/lib/api-client.ts:20-55` asks the browser Supabase client for a session for every API call and forces `cache: "no-store"`. Cache the current access token for its valid lifetime through the auth provider, and declare cache behavior per endpoint.
4. `frontend/features/demo/demo-workspace-provider.tsx:345-351` makes four parallel workspace requests on load, including a journal request with `limit=100`. Replace this with a compact dashboard/bootstrap endpoint and load large collections on demand.
5. The largest client modules—calculators (1,779 lines), simulator (1,197), dictionaries (1,055), finance tools (738), demo provider (651), quiz (640), and teacher dashboard (600)—raise parsing, ownership, and rerender risk. Split by route/tool and keep calculation engines server-independent and testable.
6. Heavy chart code is correctly client-only and dynamically imported; retain that boundary.

### Backend and database bottlenecks

- Every authenticated request calls Supabase `/auth/v1/user`, then `backend/app/api/deps/auth.py:106-123` updates, commits, and refreshes `last_seen_at`. This creates avoidable network and write amplification. Verify JWTs locally with cached JWKS, update last-seen asynchronously or at a coarse interval, and retain a remote revocation strategy where required.
- Simulator listing loads orders and trades separately for each session (`backend/app/api/routes/simulator.py:38-62,101-115`). A 20-session local request performed an estimated 41 application queries before authentication, returned 81,377 bytes, and took 97.7 ms locally.
- Journal listing counts and loads entries, then queries tags per entry (`backend/app/api/routes/journal.py:73-91,124-146`). A 20-entry local request performed an estimated 22 application queries before authentication, returned 12,532 bytes, and took 46.3 ms locally.
- Public `/catalog` returned no `Cache-Control`; private `/dashboard` correctly returned `private, no-store`. Add immutable/versioned caching or ETags to curriculum/catalogue endpoints, while preserving no-store for private state.
- Calculator logic exists twice: frontend JavaScript-number engines at `frontend/features/tools/calculators.ts:1546-1767` and four backend Decimal endpoints at `backend/app/api/routes/calculators.py:28-63`. Either remove the unused API implementation or establish shared golden fixtures and rounding contracts.

### Performance conclusion

The current application is fast on a developer machine and has sensibly isolated its chart library. The principal scale risks are request amplification, oversized client ownership boundaries, duplicated calculation paths, and no field telemetry. Before a pilot, add query-count regression tests, optimize list serialization, set public-content caching, and capture real-user LCP/INP/CLS by route and device class.

## 10. Deployment and DevOps review

### What is ready

- The backend and frontend Dockerfiles build and run as non-root users.
- Backend startup gates on Alembic migration state and exposes distinct `/live` and `/ready` endpoints.
- `docker-compose.yml`, the test overlay, and the QA/hardening configuration parse successfully.
- The isolated PostgreSQL stack became healthy, served the application end to end, and was removed with its test volume after validation.
- Render configuration runs migrations separately and has automatic deployment disabled, which is appropriate while release approval is manual.
- Vercel-compatible frontend configuration and strict public-environment validation are present.

### Release blockers and operational gaps

1. **No trustworthy source release object.** This checkout reports `No commits yet on main`, all application files are untracked, and no remote or tags are present. A deploy cannot be tied to an immutable reviewed commit, release tag, or rollback target. Restore or clone the canonical Git repository before any publication.
2. **Final images fail the intended vulnerability bar.** Docker Scout found two critical and two high CVEs in the backend final image's Perl packages, and one critical plus four high CVEs in the frontend final image's global npm toolchain. Runtime reachability appears low, but the images must be rebuilt on patched/minimal bases and rescanned; do not waive critical findings merely because the vulnerable CLIs are not called by the app.
3. **CI supply-chain references are mutable.** GitHub Actions are referenced with major tags such as `@v4`/`@v5`; base images and the PostgreSQL service also float. Pin actions by full commit SHA and production images by digest, add Dependabot/Renovate ownership, generate an SBOM/provenance attestation, and gate both dependency and final-image scans.
4. **The checked-in Gitleaks allowlist is provenance-dependent.** Seven detected values are synthetic premium-package test fixtures, but `.gitleaksignore` references a historical commit hash that cannot match a new root commit. Prefer path/fingerprint-scoped test allowlisting and prove a clean scan on the restored canonical history.
5. **Hosted authentication and data operations are unproved.** No current Vercel deployment, Render service, Supabase project, migration head, environment inventory, real signup/reset flow, backup, restoration, or rollback was inspected. Local success must not be reported as hosted success.
6. **Observability is insufficient.** `backend/app/core/logging.py:8-60` contains structured logging helpers, but `backend/app/main.py:26` configures ordinary logging; no request middleware binds IDs, and Render disables Uvicorn access logs. Add structured request/error logs, correlation IDs, deployment/version fields, redaction, metrics, alerting, and frontend/backend error monitoring. Render's request ID can be propagated when hosted there.
7. **Rate limiting is not deployment-safe.** `backend/app/core/rate_limiter.py:10-45,74-90` is process-local and keys unauthenticated requests by `request.client.host`; `render.yaml:9` starts two workers. State is therefore split, and the address can represent a trusted proxy rather than the caller. Configure trusted proxy handling, use authenticated user IDs where available, and enforce anonymous limits at a distributed/edge layer.
8. **Container hardening is partial.** Non-root is good, but package managers and unused tools remain in final images and deployment configuration does not demonstrate read-only filesystems, dropped Linux capabilities, or `no-new-privileges`. Minimize final stages and document required writable paths.
9. **Data operations are policy documents, not tested controls.** Retention has a CLI but no schedule; backup restoration, deletion/export, incident response, and schema rollback were not rehearsed. Schools need named ownership, evidence, and timings.

### Required release pipeline

Use one immutable commit and promote the same artifact through: source checks → content validation → frontend/backend tests → PostgreSQL migration test → real full-stack browser/auth tests → secret/SCA/image/SBOM gates → staging deploy → smoke/accessibility/performance checks → backup/rollback approval → production promotion. Store reports and image digests with the release. Production migration must be a separate observable step and must never call `create_all()`.

Current platform details should be rechecked during implementation. Render documents proxy/client-IP considerations and distributed limiting for multiple instances, while Uvicorn requires explicit trusted forwarded-IP configuration. GitHub documents full-length action commit SHAs as the only immutable action reference. See the external sources appendix.

## 11. Improvement roadmap

### Critical fixes

| ID  | Problem and why it matters                                                                                                                                             | Exact fix                                                                                                                                                                                                                                                                                         | Relevant files                                                                                                                                                        | Priority | Difficulty | Blocks production         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------------------------- |
| C1  | Final frontend/backend images contain critical/high CVEs. Even low-reachability tooling defeats a defensible release gate and enlarges incident scope.                 | Select patched minimal bases, remove npm/Perl/package managers from final stages where possible, pin digests, generate SBOMs, rescan final digests, and document only time-bound reachability exceptions.                                                                                         | `frontend/Dockerfile`, `backend/Dockerfile`, `.github/workflows/ci.yml`                                                                                               | P0       | Medium     | Yes                       |
| C2  | This artifact has no commits, remote, tags, or tracked files. Review, rollback, and release provenance cannot be proven.                                               | Recover/clone the canonical repository; compare this tree; review the diff; establish protected `main`, an immutable release tag, clean status, and CI evidence for the exact SHA. Repair Gitleaks fixture allowlisting before committing.                                                        | Git metadata, `.gitleaksignore`, `.github/workflows/ci.yml`                                                                                                           | P0       | Medium     | Yes                       |
| C3  | Existing E2E tests force demo fallback, so the actual browser/API/PostgreSQL/Supabase contract is untested. A build and mocked Chromium run cannot approve production. | Add a disposable staging/auth test tenant; provision two learner users and one teacher; run signup/sign-in/reset/token-expiry/ownership/onboarding/lesson/quiz/simulator/journal/classroom tests against migrated PostgreSQL and the real FastAPI origin. Keep demo E2E as a separate fast suite. | `frontend/e2e/academy.spec.ts:164-175`, `frontend/playwright.config.ts`, `.github/workflows/ci.yml:94-102`, backend auth fixtures                                     | P0       | Hard       | Yes                       |
| C4  | Render-facing limits are per-worker and keyed by an unverified proxy address, so brute-force/AI/abuse controls are unreliable.                                         | Prove the staging header chain; configure only trusted proxy IPs; move sensitive anonymous limits to Render edge/firewall or a shared limiter; key authenticated limits by user plus network; add burst/global AI budgets and tests across workers.                                               | `backend/app/core/rate_limiter.py:10-90`, `render.yaml:9`, deployment runbook                                                                                         | P0       | Hard       | Yes                       |
| C5  | The catalogue presents eight empty planned paths as “Available” and links into them. This is a major-flow truthfulness defect.                                         | Respect `path.status`; show only four active paths in the main catalogue; put planned paths in an explicitly labelled roadmap or remove them; disable navigation for empty paths; fix `010` numbering; test every state and locale.                                                               | `frontend/features/academy/catalog.tsx:54-100`, content path manifests, E2E                                                                                           | P0       | Easy       | Yes                       |
| C6  | Classroom creation accepts an activity ID whose declared type does not match `activity_type`; the mismatch was stored successfully. This weakens reporting integrity.  | Resolve the activity from the content registry server-side, reject unknown/mismatched type-ID pairs, persist the canonical type/version, migrate or audit existing mismatches, and add negative API tests.                                                                                        | `backend/app/api/routes/practical.py:421-435`, schemas/content registry, integration tests                                                                            | P0       | Medium     | Yes                       |
| C7  | Account export/deletion, demo-data clearing, scheduled retention, restore reconciliation, and school privacy operations are absent or unproved.                        | Add self-service local clear/export; authenticated export and account closure; audited school/operator deletion; scheduled retention with dry run/metrics; documented backup deletion semantics; and execute a restoration/erasure drill with named ownership.                                    | `frontend/features/demo/demo-workspace-provider.tsx:22-96,595-616`, settings UI, learning/journal/user routes, `docs/CLASSROOM_PRIVACY.md`, retention scripts/runbook | P0       | Hard       | Yes for public/school use |

### High-impact improvements

| ID  | Problem and why it matters                                                                                                                                                                    | Exact fix                                                                                                                                                                                                                                                                         | Relevant files                                                                                                                                                                                                  | Priority | Difficulty | Blocks production                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------- |
| H1  | Every private API call performs remote Supabase verification and a `last_seen_at` commit. Page hydration multiplies latency and writes.                                                       | Verify access JWTs locally using cached JWKS with issuer/audience/expiry checks; define revocation-sensitive operations; update last seen with a conditional coarse interval; instrument auth latency and failure rates.                                                          | `backend/app/api/deps/auth.py:24-63,106-123`                                                                                                                                                                    | P1       | Hard       | No, but required before scale                                 |
| H2  | Simulator and journal listings have confirmed N+1 queries; simulator lists serialize detailed histories and lack pagination.                                                                  | Add summary DTOs and detail endpoints, eager/group-load child counts/data, paginate simulator history, prefetch journal tags in one query, and assert query-count/response-size budgets.                                                                                          | `backend/app/api/routes/simulator.py:38-62,101-115`, `backend/app/api/routes/journal.py:73-91,124-146`, frontend hooks                                                                                          | P1       | Medium     | No for a small controlled pilot                               |
| H3  | Public content is client-fetched after hydration, all GETs are no-store, and global providers/auth proxy touch public routes. This raises JS, CLS, origin load, and failure dependence.       | Split public and app route layouts; server-render/version-cache catalogue/lessons; narrow proxy matching; use ETag/public caching for authored content; hydrate only interactive features; retain private no-store behavior.                                                      | `frontend/app/layout.tsx:40-44`, `frontend/proxy.ts:4-28`, `frontend/lib/api-client.ts:47-55`, `frontend/features/academy/use-academy-content.ts:228-315`                                                       | P1       | Hard       | No                                                            |
| H4  | Frontend API types are handwritten/cast and retry logic reads the wrong error shape, so all 4xx errors may retry and contract drift is unchecked.                                             | Generate types from pinned OpenAPI or share schemas; runtime-validate critical responses; change retry to inspect `AcademyApiError.status` and retry only transient/network failures with capped backoff; add 400/401/403/404/409/422/500 tests.                                  | `frontend/lib/api-client.ts:4-12,64-79`, `frontend/features/query/query-provider.tsx:18-23`, `frontend/features/academy/use-academy-content.ts:23-110`                                                          | P1       | Medium     | No                                                            |
| H5  | Structured production logging/monitoring is mostly unused; there is no proven correlation, alert, error tracking, RUM, or incident loop. Operators could not support a school/public service. | Add request-ID middleware and propagate trusted platform IDs, structured redacted logs, release/environment fields, backend/frontend error tracking, latency/error/rate-limit/AI-cost metrics, SLO alerts, synthetic smoke tests, and a staged incident exercise.                 | `backend/app/core/logging.py:8-60`, `backend/app/main.py:26`, `render.yaml:9`, frontend instrumentation, `PRODUCTION_RUNBOOK.md`                                                                                | P1       | Medium     | Yes for public/school use                                     |
| H6  | Explicit reduced motion is inert, reminder UI promises an email system that does not exist, and scattered UI strings break DE/SL parity. These are user-trust defects.                        | Wire `data-reduce-motion` to the animation selectors and persist/apply the server preference; hide/disable email reminders until a consented scheduler/delivery system exists; move every visible/accessible string into typed dictionaries and add a static string/parity check. | `frontend/features/secondary/settings-page.tsx:68-90,135-144`, `frontend/app/globals.css:223-230`, practical/marketing components listed in Section 6, dictionaries/tests                                       | P1       | Medium     | Reminder/localisation fixes block a multilingual school claim |
| H7  | CSP permits inline script; AI controls are not adequate for public enablement; CI lacks immutable action/image references and comprehensive security gates.                                   | Hash/nonce the preference bootstrap and remove script `unsafe-inline`; keep AI disabled until user/global quota, PII/output checks, cost alerts and adversarial tests exist; pin actions/images and gate SCA, secrets, SBOM, provenance, and final-image scans.                   | `frontend/config/public-environment.ts:100-115`, `frontend/app/layout.tsx:33-37`, `backend/app/services/mentor.py:76-161`, `backend/app/api/routes/practical.py:87-91`, `.github/workflows/ci.yml`, Dockerfiles | P1       | Hard       | AI: only if enabled; CI/image controls: yes                   |

### Polish

| ID  | Problem and why it matters                                                                                                        | Exact fix                                                                                                                                                                                                                                               | Relevant files                                                                                                                                                                                                  | Priority | Difficulty | Blocks production                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------- |
| P1  | The app presents too many equal top-level destinations; Journal and Tools are dense, and beginners lack a consistent next action. | Make Learn/Classroom the primary IA, put Simulator/Tools under lesson labs, group/search/favorite tools, progressively disclose journal fields, and add a single contextual next-step action after onboarding/lessons/simulator debrief.                | navigation/shell, `frontend/features/tools/finance-tools.tsx`, journal, simulator, onboarding components                                                                                                        | P2       | Medium     | No                                                      |
| P2  | Duplicate workspace/page H1s and the generic English Next.js 404 reduce navigational and assistive clarity.                       | Make the workspace label non-H1 or conditionally suppress it; add localized `not-found.tsx` with search/home/learn recovery; localize global loading/error UI.                                                                                          | `frontend/components/shell/workspace-header.tsx:22-24`, `frontend/components/academy/page-heading.tsx:22-24`, `frontend/app/error.tsx:12-18`, `frontend/app/loading.tsx:5-17`, new `frontend/app/not-found.tsx` | P2       | Easy       | No                                                      |
| P3  | The largest route components mix fetching, mapping, calculation, state, and rendering, making change risky.                       | Split them into the concrete modules proposed in Section 3, preserving behavior with focused component/hook tests and bundle comparisons after each slice.                                                                                              | simulator, tools, demo provider, quiz, teacher dashboard components                                                                                                                                             | P2       | Hard       | No                                                      |
| P4  | Browser/accessibility proof is Chromium-centric and lacks real assistive-tech and constrained-device coverage.                    | Add Firefox/WebKit to scheduled E2E, 400% zoom/reflow and text-spacing checks, NVDA/VoiceOver school workflows in DE/SL, low-end mobile throttling, and a classroom projector/touch usability session.                                                  | `frontend/playwright.config.ts:16-24`, E2E/a11y scripts, QA runbook                                                                                                                                             | P2       | Medium     | No for portfolio; required evidence for school approval |
| P5  | Documentation contains stale counts/security claims and no evidence bundle tied to a release.                                     | Generate counts/test/coverage from CI artifacts, date every readiness claim, remove “no high findings” language unless a current final-image scan supports it, and link the release SHA, migration head, SBOM, deployment checks, and known exceptions. | `README.md`, `SECURITY.md`, `PRODUCTION_RUNBOOK.md`, premium README/docs, `docs/testing/`                                                                                                                       | P2       | Easy       | No                                                      |

## 12. Final decisions

### The 10 most important improvements, in exact implementation order

1. **Restore an immutable source baseline.** Recover the canonical Git history, compare this artifact, resolve Gitleaks fixture policy, establish the reviewed release SHA, and make every following result attach to it. No other release evidence is trustworthy until this is done.
2. **Patch and minimize both final images.** Pin base digests, remove unused runtime tooling, rebuild, generate SBOM/provenance, and require zero unaccepted critical/high final-image findings.
3. **Build a real hosted staging gate.** Use a non-production Supabase tenant, migrated PostgreSQL, FastAPI, and the frontend; execute real signup/sign-in/reset/expiry plus two-user/teacher browser flows and preserve artifacts.
4. **Make the deployment security boundary real.** Prove Render proxy behavior, configure trusted forwarding, enforce distributed/edge rate limits, add user/global AI budgets, and test across workers.
5. **Repair the two confirmed domain-integrity failures.** Hide/disable the eight planned catalogue paths and reject classroom activity type/ID mismatches, including regression tests and any required data audit.
6. **Complete privacy operations.** Ship demo clear/export, authenticated export/deletion, scheduled retention, restoration/erasure reconciliation, school notices, and named incident/data owners.
7. **Install production observability and operations.** Structured correlated logs, redaction, release IDs, error tracking, metrics/SLO alerts, deployment smoke checks, backup restoration, migration rollback plan, and an incident rehearsal.
8. **Fix the frontend/backend boundary.** Generate/validate API types, correct retry rules, split public/app layouts, server-render/cache versioned content, and stop redundant session lookups and no-store use.
9. **Remove request/query amplification.** Locally verify JWTs with cached JWKS, throttle last-seen writes, replace workspace overfetching, eliminate simulator/journal N+1 queries, and add query/response budgets.
10. **Make the product claim honest and coherent.** Lead with teacher-led finance decision practice; keep four active learning paths; complete DE/SL/EN parity and motion settings; simplify navigation/journal/tools; rename or de-emphasize AI; run real school usability/accessibility sessions.

The order is intentional: provenance and vulnerable artifacts precede staging; staging exposes deployment controls; privacy and operations precede institutional data; performance and polish follow correctness. Items 1–7 are the minimum release program, not a cosmetic backlog.

### Features to remove or hide

- Remove the eight empty planned paths from the active catalogue. A separately labelled roadmap may mention them without an “Available” action.
- Remove Achievements from primary navigation until it demonstrates a learning/retention outcome; badges must not be the motivation model.
- Hide Email Reminders until a real consented delivery/scheduling system exists.
- Remove “AI” from the leading proposition and keep the provider mode disabled during the initial pilot.
- Remove the premium trading-bot packaging subtree from the public Academy release repository after preserving it in its own controlled repository.

### Features to redesign

- **Teacher/Classroom:** make this the strategic entry point, with a short teacher setup path, clear class-size/privacy constraints, canonical activity types, live facilitation states, and exportable aggregate evidence.
- **Learning catalogue:** show the four active paths and a single recommended next lesson; make Risk Management the prerequisite/flagship rather than one equal card among twelve.
- **Simulator:** retain deterministic scenarios and process-over-P&L scoring, but guide beginners through plan → risk → action/skip → debrief → journal. It is a lesson lab, not the product identity.
- **Journal:** default to a progressive short form and reveal advanced trade metadata only when relevant.
- **Tools:** organize by learner task, add search/recent/favorites, and surface calculators contextually inside lessons.
- **AI Mentor:** rename to “Decision Coach” while deterministic; if AI is enabled, constrain it to course-grounded reflection, not recommendations, and show a clear provider/privacy/cost boundary.

### Features to add

Do not add another learning surface. Add only controls needed to operate the chosen product responsibly:

- account/data export, deletion/closure, demo-device clear, and retention administration;
- real authenticated full-stack test fixtures and a staging release gate;
- structured monitoring, alerting, release evidence, backup/restore, and rollback controls;
- teacher pilot onboarding, privacy/consent material, a documented class-size limit, and aggregate outcome exports;
- field performance and accessibility evidence, including DE/SL assistive-technology sessions.

### Premium AI trading bot decision

`premium/ai-trading-bot` is not a trading bot and contains no strategy/runtime source. It contains packaging wrappers, a 1,000-plus-line defensive ZIP builder, policy/readme files, and scanner tests. Its own README explicitly says the proprietary source must remain external and paid ZIPs must never enter this public repository (`premium/ai-trading-bot/README.md:3-18`). The runtime search found no Academy import; only CI invokes its tests (`.github/workflows/ci.yml:60`).

The packager itself is thoughtfully defensive: it rejects links/path escapes, sensitive filenames, unsafe file types, oversized/non-UTF-8 input, and multiple credential literal forms (`premium/ai-trading-bot/package_bot.py:40-278,288-1024`). In a disposable writable test environment, 61 tests passed and one was skipped. The initial read-only bind produced 57 setup errors because pytest could not create `.pytest-temp`; this was an environment/write-path failure, not 57 product failures. Seven synthetic secret fixtures are intentionally detected by Gitleaks and need robust test-scoped handling.

It still does not belong in the Academy repository. It adds 61 CI tests, packaging/security policy, private-source coordination, licensing/entitlement obligations, and “AI trading bot” reputational risk to an education-first school product. Move it to a dedicated private commercial-release repository with its own CODEOWNERS, threat model, signing/SBOM, entitlement delivery pipeline, security contacts, and audit trail. The Academy may link to a separately governed offering only after an explicit brand/legal decision; it must never import the bot or imply guaranteed trading outcomes.

**Decision:** move it; do not score it as part of the Academy application; do not ship it from this repository.

### Approval matrix

| Use               | Decision               | Conditions/reason                                                                                                                                                                                                                                            |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Portfolio use     | **Approved**           | Strong visual/technical demonstration. Label it as a local/demo MVP and do not imply production deployment, complete curriculum, or AI operation.                                                                                                            |
| Controlled pilot  | **Not approved today** | Approve only after items 1–7 above, with a small named cohort, non-production environment, explicit support owner, consent/privacy material, monitoring, backups, class-size limit, and rollback/stop criteria.                                              |
| Public production | **Not approved**       | Image CVEs, missing source provenance, mocked browser integration, rate-limit/proxy uncertainty, privacy lifecycle, and absent hosted operational evidence are blockers.                                                                                     |
| School deployment | **Not approved today** | In addition to the public blockers, require institutional privacy/legal review, guardian/student notices where applicable, retention/erasure evidence, real teacher workflow tests, DE/SL assistive-technology validation, and support/incident commitments. |

### Direct professional opinion

Borza Academy is substantially better than a typical portfolio project. The backend, deterministic financial engines, content validation, visual direction, risk framing, and anonymous teacher/classroom idea show serious engineering and product judgment. It can credibly win a conversation with a school or pilot partner.

It is nevertheless **not production-ready**. The polished UI currently disguises an incomplete release system: the artifact has no usable Git provenance, the final images contain critical vulnerabilities, browser tests deliberately avoid the real backend and authentication, hosted proxy/rate-limit behavior is unproved, privacy lifecycle operations are missing, monitoring/restoration are not demonstrated, and eight empty paths are presented as available. Operating this as a public or school service now would be professionally irresponsible.

The right move is not to add features. Narrow the product to teacher-led financial decision practice, remove misleading scope, finish the release/privacy/observability foundation, and prove one real small cohort end to end. With that work, this can become a strong controlled pilot. Without it, it remains a very polished MVP.

### External documentation checked

- Render, [How Render handles DDoS attacks](https://render.com/articles/how-render-handles-ddos-attacks): current proxy/client-IP and distributed-rate-limit context.
- Render, [Logging](https://render.com/docs/logging): platform request identifier and log behavior.
- Render, [Web services](https://render.com/docs/web-services): service, health, and deployment behavior.
- Uvicorn, [Settings](https://www.uvicorn.org/settings/): forwarded-header and trusted-IP configuration.
- GitHub, [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use): immutable full-length action SHA guidance.
- Vercel Labs, [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md): UI review checklist used alongside rendered inspection.

These sources support current platform/security behavior only. They do not substitute for observing the actual future Vercel, Render, or Supabase environments.
