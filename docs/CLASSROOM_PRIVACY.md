# Classroom privacy and retention

- Use pseudonyms; never request real names, email, school IDs, income, debt, account balances, identity numbers, or personal hardship.
- Class codes and participant tokens are generated with cryptographic randomness and stored only as HMAC-SHA256 hashes using `CLASSROOM_CODE_SECRET`.
- Codes expire after four hours. Closing a session immediately blocks further joins and answers.
- Participants receive a bearer-style token once. It is scoped to one participant and session and must not be placed in URLs or logs.
- Teacher reports are aggregate-only. Response prose remains in the owner-scoped classroom store for facilitation and is not included in CSV.
- Local demo classrooms live only in that browser and are visibly labelled; they are not synced or represented as real accounts.

Before a real school pilot, the operator must define institutional retention/deletion, lawful basis, safeguarding contacts, incident response, student/guardian notices, and a paper alternative. The current four-hour access expiry is not itself a database deletion policy.
