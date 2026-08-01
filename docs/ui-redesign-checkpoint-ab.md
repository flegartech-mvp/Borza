# UI redesign checkpoint: Milestones A and B

This checkpoint establishes Borza's design system and responsive application
shell. It deliberately stops before the page-level redesign milestones.

## Information architecture

Borza now uses stable App Router workspaces instead of one long dashboard:

| Route    | Purpose                                | Checkpoint state           |
| -------- | -------------------------------------- | -------------------------- |
| `/`      | Beginner-friendly market overview      | Foundation implemented     |
| `/news`  | Searchable and filterable article feed | Existing behavior migrated |
| `/map`   | Geographic news exploration            | Existing behavior migrated |
| `/learn` | Methods, labels, and caveats           | Foundation implemented     |
| `/study` | Future private study workspace         | Honest preview only        |
| `/paper` | Future paper-trading workspace         | Honest preview only        |

Desktop navigation uses a persistent, collapsible sidebar. Small screens use a
compact header, an accessible native-dialog menu, and bottom navigation for the
primary workspaces. Every route retains a skip link and a single main landmark.

## Design system

`frontend/app/globals.css` defines semantic dark-first color tokens, a complete
light theme, spacing, radii, control heights, focus treatment, reduced-motion
behavior, and touch-target minimums. Shared React primitives live in
`frontend/components/ui/` and cover buttons, icon buttons, surfaces, status
pills, section headers, skeletons, and loading/empty/error messages.

The preference bootstrap applies the saved theme before React hydration to
avoid a theme flash. Theme supports System, Light, and Dark. Experience supports
Beginner and Expert; page-specific density and disclosure differences remain
part of the later News and Map milestones.

## State and data boundaries

- Theme, experience, and density preferences are local browser preferences.
- API credentials and provider configuration remain server-side.
- The shell renders one compact system-status control rather than repeated
  full-width freshness banners.
- Existing news filtering, pagination, WebSocket reconciliation, demo
  disclosure, and error isolation remain owned by the existing data hook.
- Map geometry remains dynamically loaded only on the Map route.
- Country metadata is now a compact local data module; the unused
  `world-countries` runtime dependency was removed.

## Accessibility and responsive behavior

- Navigation exposes `aria-current` on the active workspace.
- The mobile dialog moves focus to its close control, supports Escape/cancel,
  and returns focus to the trigger.
- Visible focus treatment is tokenized globally.
- Controls meet a 44-pixel touch minimum on coarse-pointer devices.
- Mobile content does not rely on horizontal scrolling for primary actions.
- Reduced-motion preferences disable non-essential transitions and scrolling.

## Deferred milestones

Milestones C through F will deepen individual workspaces: the Overview and News
Explorer redesign, Map and Learn refinements, meaningful Beginner/Expert
content-density differences, saved state, and full degraded/empty-state visual
coverage. The Study and Paper routes remain explicitly non-functional previews
until their real product and security boundaries exist.

## Rollback

The verified Phase 0 application is tagged `phase0-hardening-complete`. The UI
redesign lives on `codex/ui-redesign-v1`; no deployment or remote push is part
of this checkpoint.
