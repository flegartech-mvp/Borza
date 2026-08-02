# Borza Academy Workspace Rules

## Workspace layout

- This repository root is the complete Borza Academy application.
- `frontend/` and `backend/` are the only runtime applications.
- `content/academy/` contains version-controlled curriculum and deterministic simulation definitions.
- `premium/ai-trading-bot/` is separate packaging material and must never be imported by Academy runtime code.
- `docs/` contains product, architecture, security, and deployment guidance.

## Product direction

Borza Academy is a German-first interactive finance-learning platform for responsible trading practice, finance/economics students, investing beginners, and intermediate learners improving risk discipline.

Use this promise consistently:

> Learn finance. Practise trading. Build real market skills.

German:

> Finanzen verstehen. Trading üben. Marktfähigkeiten aufbauen.

Slovenian:

> Razumi finance. Vadi trgovanje. Zgradi resnične tržne veščine.

The interface must feel like a premium university-style finance course, modern learning app, educational simulator, and professional toolkit. It must not become a news reader, generic course marketplace, cryptocurrency casino, trading-guru funnel, or random card dashboard.

## Learning and content rules

- German, Slovenian, and English are first-class languages; German is the default.
- Use typed/validated translation dictionaries, not scattered hard-coded strings.
- Store stable authored curriculum in version-controlled structured content; store learner state in PostgreSQL.
- Validate IDs, ordering, prerequisites, locales, quizzes, glossary links, exercises, and sources.
- Write original instruction. Do not scrape courses, textbooks, university portals, broker education, or transcripts.
- Prefer regulators, central banks, exchanges, Investor.gov, FINRA, and official accounting/economics sources for factual verification.
- Do not imply affiliation with any university and do not use institutional logos without permission.
- Technical analysis must communicate uncertainty; never teach patterns as guaranteed predictions.
- Risk Management is a first-class path and a prerequisite for complex leveraged-product practice.

## Simulator boundaries

- Use only deterministic, licensed, or clearly labelled simulated/historical-style datasets.
- Never integrate a real brokerage, transmit real orders, or present results as real-world profitability evidence.
- Score process separately from P&L. A disciplined losing trade can outrank a reckless winning trade.
- Use decimal types for balances, prices, sizes, costs, P&L, and R multiples.
- Explain every risk metric and preserve reproducibility through content/scenario versions.

## Architecture

- Preserve Next.js, FastAPI, SQLAlchemy/Alembic, PostgreSQL/SQLite, Docker, GitHub Actions, Vercel, Render, and existing Supabase PostgreSQL compatibility.
- The normal runtime is PostgreSQL + FastAPI + Next.js. Do not add workers, schedulers, Valkey, or microservices for ordinary learning state.
- Historical news migrations remain immutable legacy history. Academy runtime code must not import or access legacy news tables.
- Any legacy table archival or cleanup must be a separate opt-in operator action; never drop production data automatically.
- Use Alembic for schema changes. Runtime processes verify schema state and never call `create_all()` operationally.

## Authentication and ownership

- Use Supabase Auth when configured for email sign-up, sign-in, and reset; public landing/demo flows remain accessible.
- Never expose a Supabase secret or `service_role` key in client code. Only URL and publishable key may use `NEXT_PUBLIC_*`.
- FastAPI verifies the caller and scopes every private query by owner.
- A user must never access another user’s notes, progress, review schedule, simulator session, order, trade, or journal entry.
- Demo state must be explicitly labelled and must not masquerade as a real account.

## UX and accessibility

- Build loading, empty, error, partial, offline/demo, validation, and success states for user-facing flows.
- Maintain keyboard navigation, semantic headings/landmarks, visible focus, screen-reader labels, chart text summaries, reduced-motion support, high contrast, and touch-friendly controls.
- Use a calm premium light/dark design. Red is for loss, danger, and errors—not urgency manipulation.
- Gamification rewards study consistency, review, journaling, and risk-rule discipline. Never add loot boxes, countdown pressure, fake prizes, gambling sounds, or celebrations for leverage.
- Keep heavy chart code client-only, dynamically loaded, and correctly cleaned up.

## Engineering rules

- Inspect relevant code before editing and keep each pass coherent.
- Do not modify reference repositories unless explicitly requested.
- Do not put secrets in source control or browser-visible variables.
- Do not rewrite unrelated files or add duplicate/heavy dependencies without a clear consuming feature.
- Run the most targeted tests, linting, type checking, migration checks, build checks, browser checks, and content validation after changes.
- Preserve the repository as a single Git root without nested repositories.
- Do not deploy or merge the Academy branch without explicit authorization.
