# Classroom privacy and retention

- Use pseudonyms; never request real names, email, school IDs, income, debt, account balances, identity numbers, or personal hardship.
- Class codes and participant tokens are generated with cryptographic randomness and stored only as HMAC-SHA256 hashes using `CLASSROOM_CODE_SECRET`.
- Codes expire after four hours. Closing a session immediately blocks further joins and answers.
- Participants receive a bearer-style token once. It is scoped to one participant and session and must not be placed in URLs or logs.
- Teacher reports are aggregate-only. Response prose remains in the owner-scoped classroom store for facilitation and is not included in CSV.
- Local demo classrooms live only in that browser and are visibly labelled; they are not synced or represented as real accounts.
- Expired classroom rows are eligible for deletion after `CLASSROOM_RETENTION_DAYS` (30 days by default). The operator runs `python -m app.cli.data_retention` to preview and repeats it with `--confirm` to delete; participant/response rows cascade with the session.

Before a real school pilot, the operator must schedule and monitor the retention command and define institutional lawful basis, safeguarding contacts, incident response, student/guardian notices, and a paper alternative. The four-hour access expiry blocks access; the separate retention command performs database deletion.
