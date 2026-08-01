# Map dashboard hardening — Step 0 baseline

Date: 2026-07-27
Scope: baseline inspection only; no geography, accessibility, UI, or dependency changes were made.

## Workspace and Git status

- Repository layout contains `frontend/`, `backend/`, `docs/`, and `premium/`.
- The frontend application directory is `frontend/`.
- Git is installed, but `C:\\Users\\tinif\\Downloads\\Borza-main (1)\\Borza-main` is not a Git worktree (`fatal: not a git repository`). As a result, branch `fix/map-dashboard-hardening` could not be created and the working-tree status is unavailable.
- At the Step 0 inspection, `premium/ai-trading-bot/artifacts/borza-ai-trading-bot.zip` existed (44,207 bytes). Its Git tracking status could not then be determined. Step 9 removed the artifact and added specific ignore protection.

## Dependency baseline

| Item | Result |
| --- | --- |
| React | `19.2.4` |
| React DOM | `19.2.4` |
| Next.js | `16.2.12` |
| react-simple-maps | `4.0.0-beta.6` |
| `legacy-peer-deps` | Enabled: `frontend/.npmrc` contains `legacy-peer-deps=true` |
| Peer dependency state | Conflict present: `react-simple-maps@4.0.0-beta.6` declares React/React DOM `^16.8.0 || 17.x || 18.x`; the application uses React 19. `npm ls --all` reports both packages as invalid. |

`package.json`, `package-lock.json`, and `.npmrc` were inspected. `npm ci` completed with the existing lockfile, so no dependency or lockfile changes were needed.

## Commands executed

| Command | Status | Result |
| --- | --- | --- |
| `git status --short --branch` | Blocked | Directory is not a Git worktree. |
| `git switch -c fix/map-dashboard-hardening` | Blocked | Not attempted after confirming Git metadata is unavailable. |
| `npm ci` | Pass | Installed 380 packages; lockfile accepted. It reported 9 high-severity findings for the full dependency tree and a pending `unrs-resolver` postinstall approval. |
| `npm run typecheck` | Pass | `tsc --noEmit` completed successfully. |
| `npm run lint` | Pass | `eslint .` completed successfully. |
| `npm run build` | Pass | Next.js 16.2.12 production build succeeded; all 4 static pages generated. |
| `npm audit --omit=dev` | Pass | `found 0 vulnerabilities`. |
| `npm ls --all` | Fail / diagnostic | Detected the React 19 peer-dependency conflict from `react-simple-maps`; platform-specific optional packages are also shown as unmet, as expected on Windows. |

## Tests, browser tooling, and screenshots

- No test files were found and `package.json` has no test script.
- No Playwright, Cypress, Puppeteer, Selenium, Vitest, or Jest configuration is present.
- `@playwright/test` occurs only as an optional peer dependency of Next.js in `package-lock.json`; it is not installed as a project test tool.
- No current screenshot assets (`.png`, `.jpg`, `.jpeg`, `.webp`) were found in the repository.

## Current component responsibilities

| File | Current responsibility |
| --- | --- |
| `frontend/app/page.tsx` | Client dashboard composition; owns filters, theme, geography selection, news stream state, demo fallback, and passes selected articles into dashboard panels. |
| `frontend/lib/geography.ts` | Geography types, global/region/country selection data, country profiles, article geography inference, and selection matching helpers. |
| `frontend/lib/types.ts` | Shared article, statistics, sentiment, urgency, and connection-status TypeScript models. |
| `frontend/components/world-news-map.tsx` | Interactive `react-simple-maps` world map; summarizes article geography/sentiment and updates the active selection. |
| `frontend/components/region-news-panel.tsx` | Selected-market story panel, ordered by impact and recency, with safe external source links. |
| `frontend/components/macro-country-panel.tsx` | Selected-market macro context placeholder; explicitly displays unavailable values until a licensed feed is connected. |
| `frontend/components/news-mini-table.tsx` | Compact selected-news table with empty state, geography labels, sentiment/impact values, and safe source links. |
| `frontend/components/sector-briefing.tsx` | Computes a primary sector and renders regional news desks for the visible articles. |
| `frontend/app/globals.css` | Tailwind import plus global light/dark design tokens, base layout, typography, and interactive-element styles. |

## Dependency risks and known limitations

- `legacy-peer-deps=true` permits installation despite the React 19 incompatibility declared by `react-simple-maps`; this is the main dependency-hardening risk for Step 1.
- `react-simple-maps` is a beta release, increasing compatibility/change risk.
- Full-tree `npm ci` audit reports 9 high-severity findings, although the required production-only audit reports none. No automatic remediation was applied in this baseline.
- `unrs-resolver` has a postinstall script awaiting explicit npm approval; the app nevertheless completed typecheck, lint, and build.
- There are no automated unit, integration, or browser tests, and no existing screenshots for visual regression comparison.
- Macro data is deliberately unavailable because the licensed macro feed is not connected.
- Git metadata is unavailable in this supplied workspace, preventing safe branch creation and confirmation of the premium ZIP's tracked state.

## Recommendation for Step 1

Restore or open the actual Git worktree first and create `fix/map-dashboard-hardening`. Then address the map's React 19 peer-compatibility decision before changing map behavior: verify a React-19-compatible stable map dependency/version (or retain the current dependency with an explicitly accepted risk), add a minimal browser-test and screenshot baseline, and only then make the requested geography/accessibility/UI hardening changes in narrow, separately verified passes.

## Step 7 final map dependency decision

Decision: **Option C** — replace `react-simple-maps` with direct local TopoJSON rendering using pinned stable `d3-geo@3.1.1` and `topojson-client@3.1.0`.

- Previous state: React `19.2.4`, Next.js `16.2.12`, and `react-simple-maps@4.0.0-beta.6`. The map package declared React/React DOM peers only through React 18 and was installed using `legacy-peer-deps=true`.
- Reason: no published `react-simple-maps` release officially supports React 19; the only available v4 releases are beta releases. Downgrading React would introduce unnecessary compatibility risk for the current Next.js 16 application.
- New state: React `19.2.4`, React DOM `19.2.4`, Next.js `16.2.12`, `d3-geo@3.1.1`, and `topojson-client@3.1.0`. `react-simple-maps` and `@types/react-simple-maps` were removed. Direct map dependencies and type packages are pinned exactly in `package.json`.
- `frontend/.npmrc` was removed. `legacy-peer-deps` is no longer enabled and the revised dependency tree installs without peer-conflict warnings.
- The map now projects the bundled `world-atlas/countries-110m.json` locally into regular React SVG paths. It retains Equal Earth projection, hover state, selected country/region styling, click and keyboard selection, responsive SVG sizing, and the existing tooltip. No runtime network request is used for map geometry.
- Clean verification: the environment safety policy blocked manual recursive removal of generated directories, but `npm ci` completed a clean lockfile-driven reinstall (451 packages). The subsequent `next build` regenerated the production build cache. All tests passed (30), typecheck and lint passed, the production build passed, and `npm audit --omit=dev` found 0 vulnerabilities.

## Step 9 premium artifact security update

The ZIP mentioned in the Step 0 historical baseline was found to contain paid
bot source code. It has been removed from the working tree, protected by
specific ignore rules, and replaced with a policy-only placeholder. The bot is
proprietary; no public source package is retained in Borza.
