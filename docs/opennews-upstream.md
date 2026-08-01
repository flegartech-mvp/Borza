# OpenNews Upstream Reference

Borza's OpenNews adapter in `backend/app/providers/opennews.py` implements the
REST contract documented by the upstream OpenNews MCP project:

- Upstream project: `6551Team/opennews-mcp`
- Upstream endpoint: `POST /open/news_search`
- Authentication: server-side bearer token
- Fields used by Borza: `id`, `text`, `link`, `newsType`, `engineType`,
  `coins`, `aiRating`, `ts`, and optional `sector`

The full MCP server is not a runtime dependency. Borza uses its own small
FastAPI provider with a finite timeout, URL validation, normalization, and demo
fallback. Selecting OpenNews without a token resolves to Borza's labeled Demo
provider. With a token configured, an upstream request failure activates the
labeled Demo fallback while preserving sanitized failure metadata, so the
ingestion run is reported as partial rather than complete. The upstream
repository was reviewed before workspace cleanup and is preserved in the
external workspace backup.

The upstream project is MIT licensed. Its notice is retained in
`docs/licenses/opennews-mcp-MIT.txt`.
