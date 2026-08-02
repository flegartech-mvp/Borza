# Borza Academy Design System

## Character

Borza Academy blends an editorial finance course, a calm learning application, and a compact professional simulator. It should feel trustworthy and motivating without imitating a casino, generic dashboard kit, or trading-guru funnel.

## Principles

1. **Learning decides the layout.** Reading surfaces are generous; simulator controls are compact; dashboards answer “what should I do next?”
2. **Risk before reward.** Amber communicates caution, red is reserved for danger/loss/error, and disciplined no-trade decisions receive positive feedback.
3. **Light and dark are peers.** Both themes use semantic tokens and tested contrast rather than inversion.
4. **Language is structural.** German, Slovenian, and English labels come from typed dictionaries and layouts tolerate expansion.
5. **Accessible by default.** Semantic landmarks, visible focus, large touch targets, text alternatives for charts, reduced motion, and no color-only meaning.

## Core tokens

| Role | Dark | Light |
| --- | --- | --- |
| Canvas | `#081019` | `#f4f1e9` |
| Reading surface | `#111b25` | `#fffdf8` |
| Elevated surface | `#172430` | `#ffffff` |
| Text | `#f5f7f4` | `#14202a` |
| Muted text | `#a5b2bc` | `#52616c` |
| Border | `#283946` | `#d8dedf` |
| Primary | `#63dfbd` | `#087e67` |
| Information | `#78aef8` | `#246eb9` |
| Caution | `#f0bf64` | `#99630e` |
| Danger/loss | `#ff8585` | `#bc3e43` |

Mastery states always pair colour with a label/icon: Not started, Introduced, Practising, Proficient, Needs review, Mastered.

## Typography

- Geist Sans for interface and reading text.
- Geist Mono for prices, formulas, durations, R multiples, and simulator statistics.
- Comfortable lesson body: 16–18px with approximately 1.65 line height and a focused 68–74 character measure.
- Dense simulator labels: 12–14px, never below accessible mobile sizes.

## Layouts

- Desktop Academy shell: 248px navigation, flexible content, contextual right panel where useful.
- Lesson: curriculum rail + focused article + objectives/glossary/notes panel.
- Simulator: full-width chart workspace with orders and analytics; panels collapse intentionally on tablets.
- Mobile: single-column lesson, sticky progress, bottom navigation with Home/Learn/Practice/Simulator/More, 44px minimum controls.

## Motion

Use short opacity/transform transitions only to preserve context. Honour `prefers-reduced-motion`; simulator replay never depends on decorative animation. Avoid autoplay celebrations, pulsing alerts, countdown pressure, or gambling-style effects.

## Required states

Every data-bearing feature provides loading, empty, error, offline/demo, partial/stale where meaningful, validation, success, and permission states. The state must explain the next useful action.
