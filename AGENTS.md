# Borza Workspace Rules

## Workspace layout

- This repository root is the complete Borza application.
- `frontend/` and `backend/` are the only runtime applications.
- `premium/ai-trading-bot/` contains packaging documentation, wrappers, and the
  distributable ZIP. Proprietary bot source is intentionally excluded.
- `docs/` contains architecture, upstream notices, and deployment guidance.

## Product direction

Build Borza as a beginner-friendly financial news and market-intelligence platform. Preserve the existing Next.js, FastAPI, SQLAlchemy/Alembic, and PostgreSQL/SQLite stack unless a change is justified.

Prioritize understandable market context, source links, clear demo/delayed-data labeling, accessible controls, and explicit loading, empty, and error states.

## OpenNews integration

- Implement OpenNews as a native server-side Borza news provider, not as an MCP runtime dependency.
- Keep `OPENNEWS_TOKEN` server-side and document it in `.env.example`.
- Preserve the demo provider as the safe fallback when credentials are missing or a provider request fails.
- Normalize API data into Borza's existing article model and keep network timeouts and errors explicit.

## Premium AI Trading Bot

- Keep the premium bot completely separate from Borza's runtime.
- Do not copy its strategy, execution, ML, exchange, backtesting, or risk-management code into Borza.
- Do not add live-trading functionality or trading-bot API routes to Borza.
- Borza may show a secondary premium product card, but must not publicly expose the paid ZIP in production.
- Until a server-side payment provider and private object storage are configured, use an honest checkout/download placeholder instead of fake purchase protection.

## Engineering rules

- Inspect relevant code before editing and keep diffs narrow.
- Do not modify reference repositories unless the user explicitly requests it.
- Do not put secrets in source control or browser-visible variables.
- Use Alembic for production schema changes.
- Run the most targeted tests, linting, type checking, and build checks available after changes.
- Preserve the repository as a single Git root without nested repositories.
