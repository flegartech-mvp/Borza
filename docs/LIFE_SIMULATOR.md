# Slovenian Life Simulator

The Life Simulator is an educational, deterministic state machine—not a forecast, benefits calculator, tax calculator, or personal recommendation. Canonical content is `content/academy/life_simulator.json`; each session stores scenario ID/version, selected profile, current round, financial state, decision history, and process score.

Six fictional profiles cover school-to-work, university, renting, leaving home, shared planning, and income uncertainty. Eight decisions span gross/net simplification, housing, transport and car costs, subscriptions, health shock, credit/scam pressure, income loss, saving, investing, and inflation.

Authenticated choices are evaluated server-side. The server applies authored numeric effects, clamps savings/debt and stress/risk bounds, scores reasoning separately from wealth, and records competence evidence. Demo choices use the same bundled JSON and deterministic TypeScript engine but stay labelled in browser storage.

All amounts are examples. Official dated facts and illustrative values are separated in `SLOVENIA_ASSUMPTIONS.md`. Changing authored effects requires a scenario-version increment, validation, and a reproducibility review.
