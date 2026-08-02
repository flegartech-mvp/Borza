# Borza Academy Project Context

## Repository layout

| Location | Role |
| --- | --- |
| `frontend/` | Next.js Academy UI, public demo, auth adapter, interactive learning tools |
| `backend/` | FastAPI learner-state, scoring, simulator, journal, and catalogue API |
| `content/academy/` | Validated authored curriculum and deterministic scenario definitions |
| `docs/` | Architecture, security, product, and deployment guidance |
| `premium/ai-trading-bot/` | Separate packaging area; never imported by Academy runtime |
| `scripts/` | Content and repository validation plus explicit legacy operations |

## Product thesis

Borza Academy helps German-speaking learners, Slovenian students, and European beginners build practical finance and market skills through explanation, calculation, deliberate practice, and reflection.

The platform is not a news reader, course marketplace, brokerage, live signal service, gambling product, or university-affiliated portal.

## Runtime decisions

1. Keep one Next.js frontend and one FastAPI backend.
2. Keep PostgreSQL/SQLAlchemy/Alembic; allow file-backed SQLite locally.
3. Store authored learning content in version control and learner state in the database.
4. Use optional Supabase Auth for email accounts; keep a clearly labelled anonymous demo.
5. Use deterministic simulated candles and never transmit real orders.
6. Use TradingView Lightweight Charts for rendering only, with attribution and accessible summaries.
7. Use FSRS for recall scheduling and multiple evidence types for mastery.

## Legacy news data

Historical migrations and production rows are preserved. The Academy runtime has no provider, feed, ingestion, worker, scheduler, WebSocket, or news-table dependency. Legacy cleanup is a separate opt-in operator action and must never run automatically.
