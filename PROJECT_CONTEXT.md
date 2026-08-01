# Borza Project Context

## Repository layout

| Location | Role |
| --- | --- |
| `frontend/` | Next.js dashboard |
| `backend/` | FastAPI ingestion and API service |
| `docs/` | Architecture, licensing, and production guidance |
| `premium/ai-trading-bot/` | ZIP-only premium product packaging |
| `scripts/` | Cross-platform repository validation |

## Existing Borza architecture

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4.
- Backend: FastAPI, SQLAlchemy 2, Alembic, APScheduler, FinBERT fallback.
- Data: PostgreSQL/Supabase with SQLite local fallback.
- News flow: demo or Finnhub provider -> worker -> deduplication -> sentiment -> impact score -> database -> REST/WebSocket dashboard.

## Product decisions

1. Borza remains one application, rather than a merge of several web apps.
2. OpenNews becomes a server-side financial-news provider compatible with the existing provider interface.
3. The AI Trading Strategy Bot remains a separate paid download; Borza only presents a modest product surface.
4. Third-party trading frameworks are not bundled, called, or exposed by Borza.
5. The dashboard is a beginner-friendly financial briefing, not a professional trading terminal.

## OpenNews reference contract

- Authenticated endpoint: `POST https://ai.6551.io/open/news_search`.
- Auth: `Authorization: Bearer <OPENNEWS_TOKEN>`.
- Main response payload: `data` array containing `id`, `text`, `newsType`, `engineType`, `link`, `coins`, `aiRating`, and `ts`.
- Normalization must be defensive because upstream payload fields can be optional.

## Premium product constraint

The paid bot ZIP must never be kept in a public frontend directory in production. A future production flow requires private object storage, server-side payment verification, and a short-lived signed download URL.

## Working sequence

1. Keep the existing feed usable while extending the provider configuration.
2. Add the OpenNews provider plus tests and documentation.
3. Improve the homepage around market context, beginner explanations, sectors, and the small premium offer.
4. Add payment/download infrastructure only after a payment provider and storage target are selected.
