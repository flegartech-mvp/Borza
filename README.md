# Borza Academy

**Learn finance. Practise trading. Build real market skills.**

Borza Academy is a German-first, multilingual finance-learning platform for responsible trading practice, finance and economics study, investing foundations, and disciplined risk management. German, Slovenian, and English are first-class interface languages.

The product combines concise lessons, worked calculations, quizzes, spaced repetition, interactive chart exercises, deterministic paper-trading scenarios, finance tools, progress tracking, and a structured trading journal. It is education software—not financial advice, a brokerage, a live-data terminal, or evidence that simulated performance will transfer to real markets.

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

- **Home** — next lesson, reviews due, weekly learning progress, mastery, streak, simulator process summary, and journal prompts.
- **Learn** — twelve curriculum paths; Finance Foundations, Trading Foundations, Risk Management, and Technical Analysis launch with complete lessons and assessments.
- **Practice** — chart exercises with hidden future candles and accessible textual summaries.
- **Simulator** — deterministic historical-style replay with educational market, limit, stop, and bracket orders.
- **Finance Tools** — trading-risk and corporate-finance calculators with formulas and interpretations.
- **Review** — FSRS-backed recall scheduling using Again, Hard, Good, and Easy grades.
- **Journal** — planned versus actual risk, emotions, rules, lessons, and repeated-pattern reviews.
- **Profile** — onboarding goals, language, theme, weekly commitment, progress, achievements, and settings.

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
