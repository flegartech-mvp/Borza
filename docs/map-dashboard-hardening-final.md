# Map dashboard hardening — final verification

Date: 2026-07-27
Scope: frontend map hardening, regression coverage, dependency cleanup, and
final production-browser verification. No backend migrations or macroeconomic
data integrations were started.

## Original problems

- Country support depended on a partial whitelist, so valid ISO countries could
  fall back to Global.
- Ticker domicile could override the country actually discussed by a story.
- Map totals mixed country-mapped, region-only, and unmapped articles.
- Map and result selection did not consistently scope every dashboard panel.
- Results silently stopped after 12 rows and were table-first on small screens.
- The map used a React peer-incompatible beta dependency with
  `legacy-peer-deps`.
- The premium artifact ZIP exposed proprietary bot source in the working tree.

## Fixes completed

- Added local ISO country metadata, aliases, alpha-2/alpha-3 normalization,
  world-atlas name matching, and region metadata.
- Added transparent subject-first geography inference with confidence, reason,
  conflict metadata, and inferred-mapping indicators.
- Added reusable geography aggregation that separates mapped-country,
  region-only, and unmapped story counts.
- Made Global, region, and country selection scope the brief, detailed feed,
  macro context label, and sector briefing together.
- Replaced silent result slicing with reset-aware 12-at-a-time Load More;
  desktop retains a table and mobile renders cards.
- Replaced `react-simple-maps` with locally projected `world-atlas` TopoJSON
  using `d3-geo` and `topojson-client`.
- Added a native country selector alongside map controls for mobile,
  arrow-key, and type-ahead country selection.
- Removed the paid source ZIP, added explicit ignore protection, and documented
  private artifact delivery.

## Files changed

Key frontend implementation files include `frontend/lib/country-metadata.ts`,
`frontend/lib/geography.ts`, `frontend/lib/geography-aggregation.ts`,
`frontend/components/world-news-map.tsx`,
`frontend/components/news-mini-table.tsx`,
`frontend/components/sector-briefing.tsx`, and `frontend/app/page.tsx`.

This final phase updated `README.md`, `docs/architecture.md`,
`frontend/components/world-news-map.tsx`, and
`frontend/components/world-news-map.test.tsx`.

## Dependency decision

React `19.2.4` and Next.js `16.2.12` remain installed. The beta
`react-simple-maps` dependency and `legacy-peer-deps` workaround were removed.
The map now uses pinned `d3-geo@3.1.1` and `topojson-client@3.1.0` with bundled
TopoJSON, so no map-geometry request is needed at runtime.

## Tests and coverage

- Vitest: 6 test files, 38 passing tests.
- Coverage: 91.37% statements, 79.45% branches, 97.67% functions, and 94.87%
  lines across the configured geography modules.
- `country-metadata.ts`: 98.64% statements, 85.91% branches.
- `geography.ts`: 84.80% statements, 74.09% branches.
- `geography-aggregation.ts`: 100% statements and branches.

The suite covers country normalization, subject-first inference, ambiguous
terms, aggregation, map keyboard controls, Global reset, inferred indicators,
responsive results, Load More, and sector scope.

## Browser verification and screenshots

The production frontend was run locally with the API intentionally unavailable
to verify its labeled demo fallback. Desktop and mobile checks covered light and
dark themes, Global/country/region selection, Slovenia's empty state, scoped
sector analysis, the native country selector, map keyboard controls, mobile
cards, and a 360px no-horizontal-overflow check.

For Load More, a temporary local 30-story browser fixture verified 12, 24, and
30 visible results. It was used only for browser verification.

- `output/playwright/borza-final-desktop-light.png`
- `output/playwright/borza-final-desktop-dark.png`
- `output/playwright/borza-final-mobile-light.png`
- `output/playwright/borza-final-mobile-dark.png`
- `output/playwright/borza-final-country-selected.png`
- `output/playwright/borza-final-region-selected.png`

No React hydration errors, missing-key warnings, dependency warnings, uncaught
runtime errors, or failed map-geometry requests were observed. The unavailable
backend scenario correctly logged expected API/WebSocket connection failures;
the temporary HTTP fixture also logged expected WebSocket handshake failures
because it did not implement the streaming endpoint.

## Known limitations

- Inferred geography remains an estimate and must not be treated as verified
  fact. Explicit backend geography has higher authority.
- Region-only stories are not assigned to a country and can only be reviewed at
  the appropriate region scope.
- Macro indicators remain unavailable until a licensed provider is integrated.
- Demo stories support interaction review but are not live reporting.
- The frontend expects a compatible REST and WebSocket backend for live mode.

## Deferred backend work

- Persist and validate explicit article country/region metadata at ingestion.
- Add source-country mappings with provenance and editorial review.
- Integrate a licensed macroeconomic provider without fabricating unavailable
  values.
- Add authenticated production entitlements and private-object-storage signed
  URLs for the proprietary premium package.
