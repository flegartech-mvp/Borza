# Borza Academy Architecture

## Runtime topology

```text
Browser
  |-- Next.js 16 UI (Vercel or container)
  |       |-- public demo state (versioned browser storage, labelled)
  |       `-- Supabase Auth session when configured
  |
  `-- FastAPI /api/v1 (Render or container)
          |-- validated authored content registry
          |-- owner-scoped learning state
          |-- quiz/mastery/review services
          |-- practical decisions, competence evidence, and classrooms
          |-- deterministic simulator and finance math
          `-- SQLAlchemy -> PostgreSQL 16 / local SQLite
```

There are no ingestion workers, schedulers, news providers, Valkey dependency, news WebSocket, or brokerage service.

## Content boundary

`content/academy/` is the canonical stable curriculum. A repository validator checks:

- unique IDs and ordered paths/modules/lessons;
- prerequisites and skill references;
- German, Slovenian, and English availability;
- question, glossary, flashcard, chart, calculator, and scenario references;
- authoritative HTTPS lesson sources;
- required launch counts and content integrity.

FastAPI reads this registry through a cached immutable loader. Content bodies are not inserted into migrations. User progress stores the content version it was completed against.

## Data boundary

PostgreSQL stores identity linkage, preferences, onboarding, enrollments, lesson state, notes/bookmarks, attempts/responses, review scheduling/history, mastery evidence, simulator sessions/orders/trades, practical-decision attempts, competence evidence, Life Simulator sessions, anonymous classroom sessions, partnership interests, journals/tags, achievements, streaks, and activity events.

Authored identifiers are stable strings. User-owned records use UUIDs. Monetary/simulator values use exact decimal columns. History endpoints are owner-scoped and paginated.

## Authentication

Supabase Auth handles email signup, sign-in, recovery, and session refresh. The browser sends the current access token to FastAPI. FastAPI verifies it with the configured Supabase Auth service, maps the verified user ID to an Academy user, and applies that ID to every private query.

Development/test may enable an explicit demo-user header. Deployed environments reject it. Anonymous demo state is not written as a real account.

## Simulator

Scenarios use deterministic generators/curated definitions. Only candles at or before the replay cursor are returned. The server evaluates market, limit, stop, stop-loss, take-profit, and bracket behavior using explicit spread, commission, and slippage. Commands use idempotency/version fields where appropriate.

The engine has no network path to a broker and no representation of real credentials.

Process scoring uses evidence fixed before the outcome: the learner's decision note, confirmation that risk and invalidation preceded size, concentration review, protective levels, scenario risk cap, leverage, and daily limits. P&L is reported separately and never increases the process score. Scenario rules that cannot yet be evaluated from durable evidence are explicitly returned as unevaluated.

## Public product surface

The Next.js public routes are independent of authentication:

- `/` explains the product, learning loop, flagship path, simulator, school use, and boundaries;
- `/schools` presents the proposed Slovenian secondary-school programme and official reference sources without claiming approval;
- `/teachers`, `/class/[code]`, and the Academy teacher dashboard provide public materials, pseudonymous participation, and owner-scoped aggregate facilitation.
- `/impact` documents current capabilities, roadmap, proposed support levels, and funding boundaries. Its consent-based interest form can transmit contact data to FastAPI with a configured retention limit; it never starts a payment.

Authenticated and labelled local-demo Academy routes share the same UI but have different persistence boundaries.

## Legacy schema

Alembic revisions `0001`–`0011` remain immutable. Their news tables are excluded from active ORM metadata and autogenerate comparisons. Academy migrations `0012`–`0014` are additive and do not drop legacy data. `0013` stores simulator precommitment evidence; `0014` stores practical-finance and classroom evidence. A separately invoked archival tool exists for a future authorized cleanup window.
