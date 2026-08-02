# Borza Academy

**Learn finance. Practise trading. Build real market skills.**

Borza Academy is a German-first, multilingual financial decision-making and risk-management academy for European beginners, students, schools, and aspiring traders. German, Slovenian, and English are first-class interface languages.

The product combines lessons, worked calculations, quizzes, spaced repetition, interactive chart exercises, deterministic paper-trading scenarios, finance tools, progress tracking, and a structured trading journal. Its core loop is: **learn a concept → investigate a realistic case → calculate or visualise → make a simulated decision → receive process feedback → reflect in a journal.** It is education software—not financial advice, a brokerage, a live-data terminal, or evidence that simulated performance will transfer to real markets.

## Architecture

```text
version-controlled Academy content
              |
      FastAPI content + learner APIs
              |
   PostgreSQL / local SQLite fallback
              |
       Next.js Academy experience
              |
 optional Supabase Auth for accounts
```

The normal local runtime has three services only:

- Next.js 16 / React 19 frontend.
- FastAPI / SQLAlchemy / Alembic backend.
- PostgreSQL 16 (with SQLite as a development and unit-test fallback).

There are no news providers, ingestion workers, schedulers, Valkey dependency, real-money orders, broker connections, or live market-data requirements.

## Product Areas

Risk Management is the flagship reference path. Finance Foundations and Trading Foundations provide prerequisites; Technical Analysis remains conditional and uncertainty-aware. Planned paths stay secondary until their authored content meets the learning standard.

- **Home** — next lesson, reviews due, weekly learning progress, mastery, streak, simulator process summary, and journal prompts.
- **Learn** — twelve curriculum paths; Finance Foundations, Trading Foundations, Risk Management, and Technical Analysis launch with complete lessons and assessments.
- **Practice** — chart exercises with hidden future candles and accessible textual summaries.
- **Simulator** — deterministic historical-style replay with educational market, limit, stop, and bracket orders.
- **Finance Tools** — trading-risk and corporate-finance calculators with formulas and interpretations.
- **Life Simulator** — eight versioned Slovenian everyday-finance decisions across income, housing, transport, shocks, credit, saving, and inflation.
- **Decision Lab and Scam Detector** — eleven applied cases and eight calibrated fraud scenarios scored on reasoning, checks, and risk process.
- **Teacher Mode** — 45/90-minute activities, expiring pseudonymous class sessions, aggregate live results, materials, and CSV reporting.
- **Competence Passport** — source/version-backed practical-finance evidence with a print-to-PDF view and contextual next actions.
- **AI Mentor** — a controlled Socratic question service with an explicit guided fallback; disabled unless a server-side provider is configured.
- **Review** — FSRS-backed recall scheduling using Again, Hard, Good, and Easy grades.
- **Journal** — planned versus actual risk, emotions, rules, lessons, and repeated-pattern reviews.
- **Profile** — onboarding goals, language, theme, weekly commitment, progress, achievements, and settings.
- **Schools** — public 35-hour programme proposal for Slovenian secondary schools, with teacher guidance and official reference points.
- **Impact** — current capabilities, roadmap, proposed €250/€500/€1,500/€5,000 support levels, funding boundaries, and a consent-based contact-interest form. There is no payment flow.

All chart and scenario datasets are labelled simulated. Process quality is scored separately from profit: a disciplined loss can be better work than a reckless win.

## Quick Start

Requirements: Docker Desktop, or Python 3.12 plus Node.js 24.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:3000`. In local mode, visitors can use the labelled demo workspace. API docs are available at `http://localhost:8000/docs` outside deployed environments.

### Run without Docker

```powershell
Set-Location backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

In another terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

## Authentication

The landing page and labelled demo lesson/scenario are public. Persisted private progress uses Supabase Auth when configured.

Backend variables:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
ACADEMY_ALLOW_DEMO_AUTH=false
```

Frontend variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Never expose a Supabase secret or `service_role` key through `NEXT_PUBLIC_*`. FastAPI verifies the caller before owner-scoped reads and writes. Direct browser access to Academy state tables is not required.

## Authored Content

Stable lessons, quizzes, glossary entries, review cards, chart exercises, calculator exercises, and simulation scenario definitions live under `content/academy/`. The validator checks identifiers, ordering, prerequisites, references, sources, and DE/SL/EN availability:

```powershell
python scripts/validate_academy_content.py
```

User state lives in the database; large lesson bodies and deterministic scenario definitions do not live in migrations.

## Database Migrations

Runtime processes verify schema state and never create tables dynamically.

```powershell
Set-Location backend
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

Migrations `0001`–`0011` preserve the historical news schema. Academy runtime code does not import or query those tables. They remain untouched for safe upgrades; the separate opt-in legacy archival script requires explicit operator confirmation and is never part of normal deployment.

Migration `0012` adds Academy identity and learner state. Migration `0013` adds simulator precommitment evidence (decision note, risk-defined confirmation, and concentration check) for process scoring that remains independent of profit.

Migration `0014` adds practical-decision attempts, competence evidence, versioned Life Simulator sessions, anonymous classroom sessions/responses, and time-limited partnership interests. It is additive and does not touch legacy news tables.

Migration `0015` adds protected learner/teacher/admin roles, partnership idempotency metadata, and explicit defense-in-depth RLS/revokes for practical-finance tables. Retention is dry-run first:

```powershell
Set-Location backend
python -m app.cli.data_retention
python -m app.cli.data_retention --confirm
```

## Product and contribution documentation

- [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) — position, audience, learning loop, and boundaries.
- [`docs/LEARNING_STANDARD.md`](docs/LEARNING_STANDARD.md) — lesson anatomy, evidence, assessment, and accessibility.
- [`docs/SCHOOL_PROGRAMME_SI.md`](docs/SCHOOL_PROGRAMME_SI.md) — maintainable Slovenian teacher programme source.
- [`docs/IMPACT_AND_FUNDING.md`](docs/IMPACT_AND_FUNDING.md) — impact model, roadmap, support, and payment boundary.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — staged product plan and explicit non-goals.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — runtime, content, data, auth, simulator, and legacy boundaries.
- [`docs/LIFE_SIMULATOR.md`](docs/LIFE_SIMULATOR.md) — deterministic financial state, assumptions, and evidence.
- [`docs/TEACHER_MODE.md`](docs/TEACHER_MODE.md) and [`docs/CLASSROOM_PRIVACY.md`](docs/CLASSROOM_PRIVACY.md) — facilitation and anonymous-session safeguards.
- [`docs/PRACTICAL_CONTENT_STANDARD.md`](docs/PRACTICAL_CONTENT_STANDARD.md) — content authoring and validation contract.
- [`docs/COMPETENCE_PASSPORT.md`](docs/COMPETENCE_PASSPORT.md) — evidence aggregation and non-certification boundary.
- [`docs/MENTOR_SAFETY.md`](docs/MENTOR_SAFETY.md) — AI feature flag, privacy, provider failure, and prompt boundary.
- [`docs/SLOVENIA_ASSUMPTIONS.md`](docs/SLOVENIA_ASSUMPTIONS.md) — dated official facts versus illustrative scenario values.

Contributions should be narrow, reviewed, and supported by the relevant validator, tests, type/lint/build checks, and source updates. Curriculum contributions must be original, multilingual, age-appropriate, and free of profit promises or implied institutional approval.

## Verification

Backend:

```powershell
Set-Location backend
python -m ruff format --check .
python -m ruff check .
python -m mypy app
python -m pytest --cov=app --cov-report=term-missing
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

Frontend:

```powershell
Set-Location frontend
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run test:performance
npm run build
npx playwright install chromium
npm run test:e2e
```

Full local gate:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/validate.ps1
```

Infrastructure:

```powershell
docker compose config --quiet
docker compose -f docker-compose.test.yml --profile integration up --build --abort-on-container-exit --exit-code-from backend-postgres-test backend-postgres-test
```

## Deployment

- Vercel hosts the `frontend/` Next.js project.
- Render hosts the single `backend/` FastAPI service and runs `alembic upgrade head` as its pre-deploy command.
- Supabase or standard PostgreSQL hosts learner state.

Deploy migration first, then API, then frontend. See `PRODUCTION_RUNBOOK.md`. This feature branch must not be merged or deployed until its full verification gate passes and an explicit release decision is made.

## Boundaries

- No brokerage integration or real order transmission.
- No live-market-data claim.
- No profitability claim or trading-guru language.
- No university affiliation, endorsement, or unlicensed logo use.
- The separate `premium/ai-trading-bot/` packaging area is not part of the Academy runtime.
