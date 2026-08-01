# Borza Architecture

## Application boundary

Borza is the only runtime application in this workspace. Its frontend is a Next.js dashboard and its backend is a FastAPI news-ingestion service backed by PostgreSQL/Supabase or the local SQLite fallback.

The premium trading bot remains a separate downloadable product. Its source is
not a Borza runtime dependency and is not included in this repository.

## News flow

```text
manual/cron/scheduler trigger
  -> PostgreSQL ingestion_jobs queue
  -> dedicated worker + monotonic database lease generation
  -> GDELT DOC 2.0 ArticleList or configured provider
  -> deduplication, registry-backed ticker extraction, method-aware article tone
  -> time-independent attention-score base
  -> Article database
  -> committed versioned event -> Valkey -> every FastAPI worker
  -> rolling-window REST reconciliation + validated WebSocket events
  -> Next.js dashboard
```

FastAPI trigger routes never execute provider, model, or article processing.
They commit an idempotent job and return HTTP 202. A separate scheduler only
enqueues, while one or more workers claim jobs with conditional updates. Every
attempt records a terminal run; stale heartbeats are reconciled conservatively.
The current owner token and monotonic fencing generation are checked inside
each article transaction immediately before commit.

Each lease-owning execution attempt owns one durable `ingestion_runs` row and
reaches `complete`, `partial`, `failed`, or `cancelled`; lock contention defers
the job without consuming an attempt. Structured provider results retain
request, successful/failed/saturated window, malformed-row, retry, warning,
error, and provider-timestamp counters. Service heartbeats expose worker
readiness independently from queue and run status.

GDELT is called with bounded, separate finance query groups, request pacing,
timeouts, retries, exponential backoff, and `Retry-After` handling. A temporary
provider failure leaves existing database records untouched; it is surfaced as a
controlled partial/failed result and never silently becomes demo news. Demo
articles are explicitly selected with `NEWS_PROVIDER=demo` or
`DEMO_MODE=true` and are labeled in API/UI data. OpenNews is the documented
exception required by the workspace rules: a missing OpenNews token selects
the labeled Demo provider, while a failed authenticated OpenNews request uses
labeled Demo records and retains the upstream failure metadata, making the run
partial rather than complete.

The provider stores only ArticleList metadata (title, licensed snippet when
returned, URL, source, time, image metadata, and derived analysis), never a
scraped full article body. The dashboard visibly attributes GDELT data to the
[GDELT Project](https://www.gdeltproject.org/); this does not imply endorsement.

`sourcecountry` is retained as the publisher/source country only. It is not
written as article subject geography, and the existing frontend geography
pipeline continues to distinguish subject geography, company domicile, and
source country.

The current attention score is derived on read from a stored time-independent
base plus a recency component that decays to zero over 24 hours. It is a
ranking heuristic, not a forecast of price movement. The `breaking` label is
only valid during its configured short freshness window.

Ticker extraction accepts a curated local provider-symbol registry, explicit
registered `$SYMBOL`/exchange forms, and mapped company names. Unknown
uppercase acronyms are intentionally rejected. The registry is maintained in
`backend/app/services/ticker_registry.py`; conservative recall is a deliberate
tradeoff against false market associations.

Ticker membership is stored authoritatively in the normalized
`article_tickers(article_id, ticker)` relationship. Exact membership filters use
a correlated relationship predicate so a multi-ticker article remains one row
through pagination and counts. Statistics group the same relationship in SQL.
The legacy JSON field is dual-written only as a temporary migration and rollback
bridge; API and WebSocket payloads continue to expose the stable sorted
`tickers: string[]` contract.

## OpenNews adapter

The OpenNews provider calls its REST API directly from FastAPI. It does not run the OpenNews MCP server at runtime.

- Endpoint: `POST {OPENNEWS_API_BASE}/open/news_search`
- Authentication: server-side `OPENNEWS_TOKEN` bearer token
- Request: the adapter requests the latest page of items with a capped limit
- Normalization: text, source, URL, timestamp, coin symbols, AI English summary, and optional sector are mapped into Borza's existing `NormalizedArticle`
- Safety: tokens never reach the browser; requests use a finite timeout; malformed rows are discarded
- Upstream contract and license: see `docs/opennews-upstream.md` and
  `docs/licenses/opennews-mcp-MIT.txt`

With `NEWS_PROVIDER=opennews`, a missing `OPENNEWS_TOKEN` selects Borza's
explicitly labeled Demo provider. When a token is present, Borza tries OpenNews
first; a failed request invokes the labeled Demo fallback and preserves the
sanitized OpenNews failure as warning/error coverage, so the ingestion result
is `partial`. A durable job retains the provider selected when it was queued:
if an OpenNews or Finnhub credential is removed before execution, that attempt
fails explicitly rather than running another provider under the stale label.
Tokens and provider error detail remain server-side.

## Schema authority

Alembic revision `0009` is the required schema head. The API, ingestion worker,
scheduler, seed, and backfill entry points verify the connected database is
exactly at that head; they do not call `create_all` or migrate operationally.
The repair command is:

```bash
cd backend && python -m alembic upgrade head
```

Revision `0006` normalizes and validates article ticker membership. Revision
`0007` adds durable ingestion jobs, per-attempt terminal and provider-coverage
metadata, monotonic lease generations, and worker/scheduler heartbeats.
Revision `0008` coalesces active scheduler/cron jobs without discarding their
requested coverage windows, and revision `0009` applies
Supabase-guarded RLS and browser-role privilege revocation.

## Frontend workspace architecture

The Next.js frontend uses a responsive application shell with dedicated
Overview (`/`), News (`/news`), Map (`/map`), Learn (`/learn`), Study preview
(`/study`), and Paper Trading preview (`/paper`) routes. Shared theme,
experience, density, navigation, and compact system-status controls live above
the route boundary. Each mounted data workspace owns one news-stream controller.

The Map workspace retains the existing geographic exploration model. Global,
country, or region selection is the single scope for its market brief, detailed
results, and sector analysis.

```text
Stored Article
  -> country metadata normalization
  -> transparent subject-geography inference
  -> geography aggregation
  -> WorldNewsMap selection state
  -> scoped brief, results, and sector analysis
```

### Country metadata normalization

`frontend/lib/country-metadata.ts` provides local metadata for all supported
ISO 3166-1 alpha-2 countries, including canonical names, alpha-3 codes,
world-atlas display names, regions, subregions, and aliases. Normalized lookups
trim whitespace, ignore case and punctuation, collapse repeated spaces, and
handle common names such as US/USA, UK/GB, Czech Republic/Czechia, and the two
Congos. No country information is fetched at runtime.

### Article geography pipeline

`frontend/lib/geography.ts` keeps distinct subject-country, company-domicile,
source-country, and region metadata. The map uses the geographic subject of
the article, not the headquarters of a referenced ticker.

The deterministic precedence order is:

1. Explicit backend `country_code`
2. Explicit backend `country_name`
3. Strong country or region signal in the title
4. Strong country or region signal in the description
5. Explicit backend region
6. Reliable source mapping
7. Ticker domicile as a low-confidence fallback
8. Unmapped/Global

Conflicting signals are retained in the article geography metadata and reduce
confidence; they are not silently overwritten. Inferred mappings have a
human-readable explanation for development and tooltip use.

### Aggregation and selection state

`frontend/lib/geography-aggregation.ts` calculates sampled articles, valid
mapped-country articles, region-only articles, unmapped articles, per-country
counts, dominant article tone, average attention score, and inferred-mapping counts. A
mapped story is only a story with a valid subject country that has a
world-atlas feature. Region-only stories appear in region selections without
inflating any individual country.

`frontend/app/(workspace)/news/page.tsx` parses initial URL filters as a Server
Component and passes them to the interactive News workspace. Country filtering
uses subject country, while region filtering includes country-level stories in
that region plus region-only stories. Selecting Global resets the geography
scope. The feed is server-paginated in 12-row pages with filters retained. Map
and sector analysis use the separately labeled, bounded analysis sample
returned by `/api/analysis`, rather than the first feed page.

### Map rendering and accessibility

`frontend/components/world-news-map.tsx` projects bundled
`world-atlas/countries-110m.json` locally with `d3-geo` and `topojson-client`.
It renders regular React SVG paths, so map geometry needs no runtime network
request. Country shading uses subject-story count, and tooltips disclose story
count, sentiment, impact, and inferred mappings.

The SVG is a visual pointer surface, not a collection of hundreds of keyboard
buttons. A native country selector is the primary accessible interaction and
provides arrow-key/type-ahead navigation, one predictable tab stop, and visible
focus. Selection changes update a polite textual summary containing coverage,
tone, attention, and inference information. Region filters and Global reset
remain native buttons.

### Results, sectors, and fallback behavior

The detailed news component requests 12 results initially, reports the
server-filtered total, and requests the next server page through Load More. It
resets when geography or filtering changes.
Desktop renders a dense table, while small screens render semantic stacked
cards without primary horizontal scrolling. Invalid demo URLs do not render
broken external links.

The sector briefing receives the currently scoped article collection and labels
its Global, country, or region sample size. It renders only visible article
facts: sector, sampled story count, average attention score, dominant article tone, related
tickers, and a representative headline.

Feed, analysis, statistics, freshness, and WebSocket transport have independent
states. A valid feed remains visible when a secondary endpoint fails. Demo
fallback is allowed only when the first feed request is genuinely unreachable,
never for a 4xx/filter validation or response-contract error. REST
reconciliation remains active while WebSocket is connected.

Realtime pub/sub is intentionally non-durable and at-least-once. Workers publish
strictly versioned events only after the article transaction commits. Every
FastAPI process owns an independent Valkey subscription and validates event
schema and size before local WebSocket fanout; periodic REST reconciliation is
the authoritative gap-repair path.

## Geographic accuracy limitations

Inferred locations are estimates. Company domicile can differ from the country
actually discussed in a story, and region-only news may not map to a single
country. Explicit backend geography has higher authority than inferred signals.
Users must not treat inferred geography as a verified fact.

## Data integrity rules

- Never fabricate macroeconomic values; unavailable values remain unavailable.
- Label demo data whenever the fallback feed is in use.
- Label inferred geography in map-level indicators and tooltips.
- Exclude unmapped and region-only stories from individual-country counts where
  appropriate.
- Derive sector metrics and summaries only from the currently visible article
  collection.

## Premium AI Trading Bot

The bot is a separate paid downloadable product. The current Borza card is intentionally a non-functional checkout placeholder. A production download flow requires a payment provider, server-side purchase verification, private object storage, and short-lived signed URLs.
