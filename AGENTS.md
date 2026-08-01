# Borza Workspace Rules

## Workspace layout

- This repository root is the complete Borza application.
- `frontend/` and `backend/` are the only runtime applications.
- `premium/ai-trading-bot/` contains packaging documentation, wrappers, and the
  distributable ZIP. Proprietary bot source is intentionally excluded.
- `docs/` contains architecture, upstream notices, and deployment guidance.

## Product direction

Borza is a German-first European market-intelligence platform for three connected audiences:

1. German retail investors and active traders.
2. European day traders who need rapid, structured market catalysts.
3. Slovenian economics and finance students, especially students in Maribor and Ljubljana.

The primary commercial market is Germany and the wider DACH and European trading market. The student product is a separate learning and acquisition layer that connects current German and European financial news with economics, finance, banking, investing, and business-German studies.

Use this thesis consistently:

> Borza turns German and European market news into structured trading catalysts and understandable financial knowledge.

The primary experience is **Borza Markets**: a German-first, information-dense workspace focused on DAX, MDAX, SDAX, TecDAX, Xetra, Frankfurt, German and major European companies, ECB and Bundesbank policy, BaFin regulation, Destatis macro releases, earnings, and intraday catalysts. Preserve original language and source links. Never present article tone or relevance as a certain price prediction.

The secondary experience is **Borza Learn**: a clearly separated German, Slovenian, and English learning layer using the same market events. It may connect events to economics, finance, banking, investing, and business-German concepts, but must not imply university affiliation or endorsement.

Official German and European primary sources outrank discovery and editorial aggregators. Prioritize verified feeds from Deutsche Bundesbank, BaFin, Destatis, Deutsche Börse, Börse Frankfurt, ECB, ESMA, European Commission releases, and permitted company investor-relations sources. Marketaux is the primary keyed discovery provider. GDELT remains an optional low-frequency research fallback, and no discovery-provider failure may block healthy official feeds.

Treat EQS News as a high-value licensing target. Do not scrape, republish, or commercially redistribute EQS content until stable technical access and redistribution terms are verified. A permitted integration should initially preserve headlines, metadata, and original links rather than full release text.

Build toward catalysts, companies, calendars, watchlists, alerts, event timelines, velocity, source counts, saved filters, and market briefings. Do not expose navigation, pricing, checkout, or controls for capabilities that are not genuinely operational.

Preserve the existing Next.js, FastAPI, SQLAlchemy/Alembic, and PostgreSQL/SQLite stack unless a change is justified. Prioritize source credibility, duplicate grouping, time since publication, transparent uncertainty, accessible compact controls, and explicit loading, empty, partial, stale, and error states.

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
