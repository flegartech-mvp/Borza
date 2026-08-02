# Borza Academy content registry

This directory contains the version-controlled, authored learning content for the
Borza Academy launch curriculum. It deliberately contains no user state and no
runtime code.

The registry is split by concern:

- `manifest.json` declares the schema version, locales, file set, and launch floors.
- `paths.json` describes all twelve paths and their honest availability state.
- `lessons.json` contains the four launch paths, modules, and lesson bodies.
- `questions.json` contains localized assessment items and answer specifications.
- `glossary.json` and `review_cards.json` provide reusable learning references.
- `practice.json` defines chart, calculator, and deterministic simulator exercises.
- `sources.json` is the allow-listed catalogue of public, authoritative references.

All authored prose is original. Source links support factual verification and
further reading; their wording is not copied into lessons. Exercises and scenarios
use explicitly labelled simulated data. Nothing in the registry is financial advice
or a promise of performance.

Validate from the repository root:

```powershell
python scripts/validate_academy_content.py
```

The command fails on broken references, missing translations, duplicate IDs,
invalid ordering or prerequisites, non-authoritative source URLs, and launch-count
regressions. It prints machine-readable exact totals when validation succeeds.
