# Privacy review

## Data and boundaries reviewed

- Authenticated: profile/preferences, goals, progress, notes, review history, journal, simulator state, practical attempts, competence evidence and Life Simulator sessions.
- Classroom: four-hour hashed code, one-time hashed participant token, pseudonym, reasoning/answer and aggregate teacher metrics.
- Partnership interest: organisation/role/email/message/consent with an explicit expiry.
- Demo: browser-local labelled state, not a real account and not evidence suitable for certification.

Private API queries remain owner-scoped. Red-team cases covered two learners, two teachers, wrong classroom/session tokens, token replay, duplicate pseudonyms, closed/expired sessions, CSV aggregation and attempted teacher-role escalation. A learner gets 403 on teacher APIs; a different teacher receives 404; CSV/dashboard output excludes pseudonyms and response prose.

## Confirmed privacy fixes

- Migration 0015 explicitly revokes `anon` and `authenticated` from all practical tables and enables RLS. PostgreSQL verification confirmed the synthetic Data API roles have no SELECT grant.
- Teacher authorization trusts only protected application metadata.
- Classroom participant tokens never appear in teacher responses and are scoped to one participant/session. Completed-token replay and cross-session use return 404.
- Partnership acceptance never echoes the contact email. Optional idempotency prevents duplicate retry records.
- `python -m app.cli.data_retention` is dry-run by default. `--confirm` deletes expired partnership records and classroom sessions older than `CLASSROOM_RETENTION_DAYS`; classroom participants/responses cascade.
- Mentor requests reject email, IBAN-like and long payment-card-like values before optional provider use.

## Retention and minor safety

Default database retention is 30 days after expired classroom access and 180 days for partnership contacts. The four-hour class-code window is access expiry, not deletion. Before a school pilot the operator must schedule the confirmed retention command, alert on failure, publish the applicable notice/lawful basis, define safeguarding and incident contacts, and provide a paper/non-account alternative.

The product instructs learners to use pseudonyms and not submit names, school IDs, income, debt, accounts or hardship. These are behavioral safeguards, not a substitute for the operational school agreement. Free-text classroom reasoning is still personal data if a learner self-identifies.

## Remaining risks / unverified

- The retention job is intentionally not an application worker; operator scheduling and evidence are unverified.
- Hosted backups may retain deleted records according to the database provider's backup policy. Restore/deletion reconciliation was not tested.
- Real school notices, guardian/learner consent or other lawful basis, DPIA/records of processing, data-processing agreements, subject-rights workflow and breach process require institutional/legal review.
- Live Supabase users and production data were not used.

Release implication: privacy controls support an isolated preview and, after operator/legal setup, a controlled pilot. They do not by themselves authorize a broad minor-facing production launch.
