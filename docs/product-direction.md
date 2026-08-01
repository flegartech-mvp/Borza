# Borza Product Direction

## Product Thesis

Borza turns German and European market news into structured trading catalysts and understandable financial knowledge.

- German: **Borza verwandelt deutsche und europäische Finanznachrichten in strukturierte Marktsignale und verständliches Finanzwissen.**
- Slovenian: **Borza pretvarja nemške in evropske finančne novice v strukturirane tržne signale in razumljivo finančno znanje.**

Borza is not a Slovenia-only news dashboard and is not a generic article reader. Germany and the wider DACH and European trading market are the primary commercial focus. Slovenian students are a distinct education and acquisition audience.

## Product Modes

### Borza Markets

The primary mode is a German-first, desktop-first market workspace for active investors and traders. It prioritizes DAX, MDAX, SDAX, TecDAX, Xetra, Frankfurt, German and major European companies, ECB and Bundesbank policy, German macro releases, regulation, earnings, and intraday catalysts.

The core unit should evolve from an article into a catalyst that answers:

- What happened?
- Which company, ticker, index, sector, currency, or asset may be affected?
- When was it first seen and most recently updated?
- How many independent sources describe the event?
- Which source is primary and how trustworthy is it?
- Why might a trader care?
- Is the potential direction positive, negative, mixed, or unclear?

Direction and relevance are contextual labels, never guaranteed price predictions.

### Borza Learn

The secondary mode reuses the same events for German, Slovenian, and English learning. It should connect current news with macroeconomics, monetary economics, banking, financial markets, investments, corporate finance, accounting, international economics, econometrics, risk management, and business German.

Future learning layers may include simple, finance-student, and advanced explanations; terminology; German-Slovenian vocabulary; cited examples; quizzes; exam questions; notes; and historical comparisons.

Borza must not imply affiliation with or endorsement by a university. Institution names and branding require careful factual context and formal permission where applicable.

## Shared Platform

Markets and Learn share:

- composite ingestion and provider isolation;
- normalized articles and future event entities;
- companies, tickers, topics, sectors, and asset classes;
- source trust, relevance, duplicate grouping, and provenance;
- original-language content and original-source links.

Generated summaries and translations must be labeled separately from publisher text. Proper names, ticker symbols, and official institution names must remain intact.

## Source Hierarchy

1. Verified official, regulatory, statistical, exchange, and company investor-relations sources.
2. Permitted professional editorial sources.
3. Marketaux as the primary broad financial discovery provider.
4. Optional low-frequency research providers such as GDELT.
5. Explicitly labeled demo data only when intentionally enabled.

The default German backbone uses verified feeds from Deutsche Bundesbank, Destatis, Deutsche Börse, Xetra/Frankfurt, and the ECB. Marketaux supplies keyed DACH/EU discovery when configured; GDELT remains optional. EQS News, BaFin, ESMA, European Commission, and company investor-relations integrations remain targets until stable, permitted endpoints and redistribution terms are verified. No dead or guessed feed URL may ship.

## Delivery Order

The intended product hierarchy is Markets, Catalysts, Companies, Calendar, Watchlists, and Learn. Navigation must expose only operational destinations.

Near-term engineering order:

1. German official-source coverage and trustworthy catalyst grouping.
2. German-first interface with explicit language preferences.
3. Company/ticker entities and DAX-family classification.
4. Catalyst timelines, velocity, calendars, watchlists, and alerts.
5. Multilingual Learn explanations and study workflows.
6. Entitlements and billing only when subscriptions are genuinely operational.

The current release implements article normalization, official-source priority, bounded duplicate grouping, relevance metadata, filters, and Markets/Learn route foundations. It does not yet claim operational watchlists, alerts, company pages, calendars, translations, subscriptions, or university integrations.
