# Accessibility review

## Result

The production-shaped Chromium suite passed on Desktop Chrome and Pixel 7 emulation. Final results were 18 passed/1 mobile-only skip on desktop and 19 passed on mobile; a separate keyboard/API-failure file adds two tests per project and passed on both.

Automated axe 4.12.1 scans cover 20 core routes and eight practical routes using WCAG 2 A/AA, WCAG 2.1 A/AA, WCAG 2.2 A/AA and best-practice tags. Color contrast is enabled. All final scans returned zero violations.

## Confirmed fixes

The original test explicitly disabled `color-contrast`. Enabling it revealed serious CTA failures on landing, schools, impact, home, lesson and teachers routes. An unlayered `a { color: inherit }` rule overrode Tailwind text utilities, producing 1.68:1 and 3.3:1 combinations. Moving the anchor default into the CSS base layer restored intended foreground colors.

Mobile scanning also caught the global loading fallback while it was mounted: `<main role="status">` was not an allowed role and had no level-one heading. The loading state now uses semantic `<main aria-busy="true">` and a screen-reader h1.

The catalogue performance fix preserved accessibility; the final `/learn` CLS is below 0.10.

## Interaction and responsive evidence

- Keyboard-only regression tabs to the public Academy link, verifies a visible outline of at least 2 px, activates it with Enter, and reaches `/learn` on desktop and mobile emulation.
- Every main route is checked for a visible `<main>` landmark and horizontal overflow.
- Mobile bottom navigation and its More menu are exercised.
- Lesson, quiz, simulator, onboarding, review, calculator, journal and language-switch journeys use accessible names/roles in real browser automation.
- Global CSS has visible focus styles and reduced-motion overrides; skeletons/spinners also disable motion in reduced-motion mode.

## Remaining accessibility work

- Axe and emulation do not replace testing with NVDA/JAWS/VoiceOver, switch control, zoom/reflow at 200–400%, forced-colors mode, or users with disabilities.
- Automated contrast was tested in the deterministic light-theme journey; dark theme has designed tokens but needs the same manual assistive-technology matrix.
- Chart text summaries are present in covered routes, but screen-reader comprehension of every chart and financial table was not manually assessed.
- Native mobile Safari/VoiceOver and Android TalkBack devices were not available.

Recommendation: no automated WCAG blocker remains for preview/pilot, but complete assistive-technology and zoom testing before a broad school launch.
