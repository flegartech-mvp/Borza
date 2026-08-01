# Borza Financial News Provider Assessment

This document evaluates potential financial news data providers for the Borza platform, detailing their costs, licensing terms, authentication requirements, operational boundaries, and final selection status.

---

## Provider Comparison Matrix

| Provider | Cost | Authentication | Free-Tier Limits | Commercial Use Basis | Historical / Coverage | Status | Reason Accepted / Rejected |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GDELT Project** | Free (Public) | None required | None (Public dataset) | Public data, attribution required | Global 2.0 ArticleList, real-time & deep archive | **Accepted (Primary)** | Free, global coverage, no rate limits, allows title/url/metadata discovery without full-text copyright violation. |
| **RSS / Atom Feeds** | Free (Public) | None required | Variable per feed | Public official releases (central banks, regulators) | Real-time official announcements | **Accepted (Supplemental)** | Direct first-party official sources (ECB, Fed, Banka Slovenije, SEC), no commercial license issues, high authority. |
| **Finnhub** | Free / Paid | API Key required | 60 requests/min | Free tier restricted to non-commercial / dev | U.S. / Global market news | **Optional (Secondary)** | Retained as configurable fallback when licensed API key is supplied by site operator. |
| **Alpha Vantage** | Free / Paid | API Key required | 25 requests/day (free) | Free tier strictly limited | US equities news & sentiment | **Rejected as Primary** | Volume cap (25 req/day) is insufficient for continuous automated news ingestion. |
| **NewsAPI** | Paid in prod | API Key required | Developer plan only (localhost) | Commercial use forbidden on free plan | Global news outlets | **Rejected** | Free developer plan explicitly bans production deployment (`localhost` only) and commercial apps. |
| **The Guardian API** | Free / Paid | Developer Key | Open tier | Non-commercial use only | Guardian articles only | **Rejected** | License explicitly restricts commercial use and limits coverage to a single publisher. |

---

## Primary Free Strategy: GDELT Project (DOC 2.0 ArticleList API)

### 1. Integration & Architecture
- **Endpoint**: `https://api.gdeltproject.org/api/v2/doc/doc`
- **Mode**: `artlist` (JSON metadata format)
- **Authentication**: None required.
- **Attribution**: Explicitly labeled in the Borza UI as *"Data source: GDELT Project"* linking to `https://www.gdeltproject.org/`.

### 2. Copyright & Fair Use Compliance
- Borza fetches and stores only **headline, canonical URL, publisher domain, publication timestamp, language, source country, and short provider snippet/image URL**.
- Borza **never scrapes or republishes full article bodies**.
- Every story row and detail drawer includes a direct link to the original publisher article.
- Inferred sentiment, categories, and country mappings are clearly labeled as derived heuristics.

### 3. Query Strategy & Topical Groups
GDELT query groups are configured to hit 20 distinct topical areas:
1. `markets`: Stock indices, equities, shares, global markets.
2. `european_markets`: DAX, FTSE, CAC 40, Euro Stoxx, European economy.
3. `slovenian_economy`: Ljubljana Stock Exchange (LJSE), Banka Slovenije, SURS, Slovenian economy.
4. `central_banks`: Federal Reserve, ECB, Bank of England, Bank of Japan.
5. `interest_rates`: Rate hikes/cuts, monetary policy, yield curve, benchmark rates.
6. `inflation`: CPI, PPI, price pressure, hyperinflation, core inflation.
7. `employment`: Nonfarm payrolls, job growth, unemployment, wage growth.
8. `gdp_recession`: GDP growth, economic contraction, stagflation.
9. `stocks`: Earnings, dividends, buybacks, quarterly guidance.
10. `bonds`: Sovereign debt, treasury yields, government bonds.
11. `forex`: Foreign exchange, EUR/USD, USD/JPY, exchange rates.
12. `commodities`: Wheat, metals, copper, lithium, raw materials.
13. `oil_gas`: Crude oil, Brent, WTI, natural gas, OPEC.
14. `gold`: Bullion, gold spot, silver, safe-haven assets.
15. `crypto`: Bitcoin, Ethereum, digital assets, blockchain.
16. `banking`: Commercial banking, credit liquidity, systemic risk, deposits.
17. `earnings`: Quarterly reports, profit margins, EPS beats.
18. `ma`: Mergers, acquisitions, buyouts, dealmaking.
19. `regulation`: SEC filings, antitrust, regulatory enforcement, sanctions.
20. `geopolitics`: Tariffs, trade wars, sanctions, geopolitical supply chain risk.

### 4. Operational Resilience
- **Single Reused Client**: `httpx.AsyncClient` with connection pooling (`max_keepalive_connections=10`, `max_connections=20`).
- **Bounded Requests**: Explicit `request_timeout_seconds=20` and per-query limits.
- **Exponential Backoff & Jitter**: Automatic retries for 429 and 5xx responses.
- **Circuit Breaker / Cooldown**: 3 consecutive failures trigger a 60-second cooldown period to prevent upstream hammering.
- **Outage Fallback**: During temporary GDELT outages, Borza continues serving stored database records. Live feeds are never silently replaced with demo data.

---

## Supplemental Official Feeds: RSS / Atom Provider

To augment GDELT with instant first-party official announcements, Borza integrates a native RSS/Atom provider (`backend/app/providers/rss.py`).

### Supported Feeds
- **European Central Bank**: `https://www.ecb.europa.eu/rss/press.html`
- **Federal Reserve**: `https://www.federalreserve.gov/feeds/press_all.xml`
- **Banka Slovenije**: `https://www.bsi.si/rss/novice`
- **SEC Press Releases**: `https://www.sec.gov/news/pressreleases.rss`

### SSRF Protection Specification
All configured and user-defined RSS feed URLs undergo strict pre-flight validation before HTTP connection:
1. **Scheme check**: Only `http` and `https` protocols are allowed.
2. **Host check**: Rejects `localhost`, `127.0.0.1`, `::1`, `metadata.google.internal`.
3. **DNS IP Resolution**: Resolves hostnames via `socket.getaddrinfo` and checks against:
   - Loopback: `127.0.0.0/8`, `::1`
   - Private IPv4: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Link-local / Cloud metadata: `169.254.0.0/16` (specifically `169.254.169.254`)
   - Multicast & reserved IP blocks.
4. **Redirect Protection**: Automatic redirects are disabled (`follow_redirects=False`). Redirect target URLs are re-validated against SSRF rules before following.

---

## Source-Quality & Tiering Model

Borza assigns every ingested story to a source quality tier:
- **Tier 1 (Official & First-Party)**: Central banks, regulators, official statistical agencies (e.g. `ecb.europa.eu`, `federalreserve.gov`, `bsi.si`, `sec.gov`).
- **Tier 2 (Established Media)**: Recognized international financial publishers (e.g. `reuters.com`, `bloomberg.com`, `ft.com`, `wsj.com`).
- **Tier 3 (Specialist & Regional)**: Specialized or regional economic outlets (e.g. `finance.si`, `delo.si`, `sta.si`).
- **Tier 4 (General / Unknown)**: Aggregators, blogs, and unclassified domains.

*Note: Source tiers influence ranking algorithms and badges, never censorship. Users can inspect any original publisher link.*
