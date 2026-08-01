# Borza Design System & Visual Architecture

## Overview

Borza’s design system is engineered for professional financial market intelligence. It balances high information density with exceptional readability, calm dark/light surfaces, crisp typography, and disciplined visual hierarchy suitable for all-day terminal and mobile use.

---

## 1. Design Principles

1. **Professional & Data-Focused**: No flashy marketing gimmicks, unnecessary glassmorphism, or fake price charts. Data integrity and source transparency are paramount.
2. **Dense but Readable**: High-density layouts for desktop monitoring paired with generous touch targets and clear spacing on mobile devices.
3. **Cohesive Light & Dark Modes**: First-class support for both light and dark themes using semantic color tokens that preserve contrast ratios without simple color inversion.
4. **WCAG 2.2 AA Accessibility**: Full keyboard navigation, visible focus rings (`--focus-ring`), semantic HTML5 landmarks, ARIA live regions, and screen-reader announcements.

---

## 2. Color Palette & Tokens

### Dark Mode (Default)
- **Background (Canvas)**: `#0b0f13` (Deep slate black)
- **Surface 1 (Base Cards)**: `#10161c`
- **Surface 2 (Elevated / Hover)**: `#151d24`
- **Surface 3 (Active / Inputs)**: `#1b252e`
- **Border Subtle**: `#24313b`
- **Border Strong**: `#354653`
- **Text Primary**: `#f1f5f7` (Contrast > 12:1)
- **Text Secondary**: `#a5b1bb` (Contrast > 4.5:1)
- **Text Tertiary**: `#74828e`
- **Brand Primary**: `#5ee0b5` (Financial mint green)
- **Positive Accent**: `#50d890` (Bullish market indicator)
- **Negative Accent**: `#ff7b7b` (Bearish market indicator)
- **Warning Accent**: `#f7c66b` (Stale / Caution indicator)
- **Information Accent**: `#75aef5` (Neutral / Provider info)

### Light Mode
- **Background (Canvas)**: `#f4f7f8` (Cool off-white)
- **Surface 1 (Base Cards)**: `#ffffff`
- **Surface 2 (Elevated / Hover)**: `#f7f9fa`
- **Surface 3 (Active / Inputs)**: `#eef2f4`
- **Border Subtle**: `#dce3e7`
- **Border Strong**: `#b8c4cb`
- **Text Primary**: `#101820`
- **Text Secondary**: `#4d5d68`
- **Text Tertiary**: `#73818a`
- **Brand Primary**: `#087d5d`
- **Positive Accent**: `#148451`
- **Negative Accent**: `#c94343`
- **Warning Accent**: `#9a6813`
- **Information Accent**: `#286eb7`

---

## 3. Typography Scale

Borza utilizes `Geist Sans` and `Geist Mono` (with standard system fallbacks: `system-ui, -apple-system, sans-serif`).

| Token | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Heading 1** | 24px (1.5rem) | 32px (1.33) | 600 (Semibold) | Page titles, primary dashboard headings |
| **Heading 2** | 18px (1.125rem) | 26px (1.44) | 600 (Semibold) | Section headers, panel titles |
| **Heading 3** | 15px (0.9375rem)| 22px (1.46) | 600 (Semibold) | Story headlines (card level) |
| **Body Base** | 14px (0.875rem) | 20px (1.42) | 400 (Regular) | Default content text, descriptions |
| **Body Small**| 13px (0.8125rem)| 18px (1.38) | 400 (Regular) | Table rows, secondary meta info |
| **Caption**   | 12px (0.75rem)  | 16px (1.33) | 500 (Medium)  | Badges, timestamps, ticker pills |
| **Mono Code** | 13px (0.8125rem)| 18px (1.38) | 500 (Medium)  | Revisions, timestamps, numeric stats |

---

## 4. Component Standards

### Story Cards & Rows
- **Headline**: Prominent 15px/600 text linking to detail view or publisher.
- **Source Badge**: Color-coded by source quality tier (Tier 1 Official = Emerald, Tier 2 Established = Blue, Tier 3 Specialist = Slate).
- **Metadata**: Published timestamp (relative + absolute UTC tooltip), provider tag (`GDELT` / `RSS`), source country flag/code.
- **Provenance Link**: External link icon pointing directly to original publisher canonical URL.

### Filter & Controls Bar
- Sticky control bar with unified filter inputs:
  - Search input with clear button
  - Category selector
  - Sentiment dropdown (Positive, Negative, Neutral)
  - Time window selector (24h, 48h, 7d)
  - Freshness indicator badge (Live / Offline / Cooldown)

### Responsive Breakpoints
- **Desktop (>= 1280px)**: Multi-column layout with sticky sidebar navigation (`248px` width), main stream (`flex-1`), and side metrics drawer.
- **Laptop (1024px - 1279px)**: Collapsible sidebar navigation (`72px` collapsed), 2-column dashboard.
- **Tablet (768px - 1023px)**: Single column with top bar header and responsive drawer filter.
- **Mobile (< 768px)**: Bottom tab navigation (`64px` height), sticky mobile header, full-width responsive cards, tap targets >= 44x44px.

---

## 5. User Interface States

Every component explicitly supports all 10 core UX states:
1. **Initial Loading**: Animated skeleton layout matching component geometry.
2. **Incremental Loading**: Subdued spinner or inline skeleton row.
3. **Empty Feed**: Informative state message with reset filter suggestion.
4. **Empty Search**: *"No articles found for search query X"*.
5. **Provider Outage**: Non-intrusive warning banner (*"GDELT provider temporarily unavailable; displaying cached news records"*).
6. **Backend Offline**: Alert banner with auto-reconnect retry status.
7. **WebSocket Disconnected**: Realtime badge changes from "LIVE" to "POLLING".
8. **Rate Limited (429)**: Backoff message with `Retry-After` countdown.
9. **Stale Data**: Data freshness panel highlights staleness.
10. **Demo Mode**: Unambiguous yellow badge indicating synthetic demo fallback.
