# Borza Academy Security Policy

## Security boundaries

Borza Academy protects learner identity, private notes and journal entries, progress, review schedules, and simulated trading records. The simulator never communicates with a brokerage and must not contain real-order credentials or code paths.

## Secrets

- Credentials, tokens, private keys, database URLs, and passwords must never enter Git.
- Browser-visible configuration is limited to public URLs and the Supabase publishable key.
- Never expose a Supabase secret or `service_role` key through `NEXT_PUBLIC_*`.
- Local `.env*` files remain ignored. `.env.example` contains only blanks or explicit placeholders.

## Authentication and authorization

- Supabase Auth issues the user session; FastAPI validates the bearer token before trusting identity.
- Do not authorize from editable `user_metadata` claims.
- Every private database query includes the verified `user_id` predicate.
- Child resources are loaded through `(resource_id, user_id)` scope; foreign resources return not found.
- Demo-user headers are allowed only in development/test when explicitly enabled and are rejected in deployed environments.

## Database and Supabase

- Use Alembic migrations and `Numeric`/decimal values for financial simulation fields.
- Direct browser access to Academy state tables is not needed; revoke Data API access for `anon` and `authenticated` roles.
- Enable RLS as defense in depth on user-owned tables and use ownership predicates for any future Data API policy.
- Historical news tables are legacy data. Normal migrations neither read nor drop them.
- Never run the opt-in legacy cleanup tool against production without a reviewed backup and explicit authorization.

## Browser and content safety

- Next.js sets CSP, frame, MIME-sniffing, referrer, and permissions headers.
- Authored content is rendered through controlled structured blocks. If Markdown support is extended, sanitize HTML before rendering.
- External source URLs are validated as HTTPS and open with safe `rel` attributes.
- Charts provide textual summaries and use deterministic simulated datasets; no script is loaded from TradingView at runtime.

## Abuse controls

The FastAPI rate limiter is process-local and is defense in depth, not a distributed production quota. Production deployments should add platform/WAF rate limits for sign-in, quiz submission, journal writes, and simulator commands. API inputs have explicit schemas, sizes, pagination bounds, and idempotency where state transitions require it.

## Reporting

Do not include secrets, access tokens, private learner content, or production database samples in issues, logs, screenshots, or test fixtures. Report suspected vulnerabilities privately to the repository owner.
