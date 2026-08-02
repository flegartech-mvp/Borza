# Borza Academy Security Review

## Protected assets

- Supabase sessions and backend credentials.
- Learner profiles, goals, notes, progress, review schedules, and journal content.
- Simulator sessions, orders, trades, and analytics.
- Database integrity and authored-content provenance.

## Trust boundaries

1. Browser to Supabase Auth.
2. Browser to FastAPI with a bearer access token.
3. FastAPI to PostgreSQL using a server-side database role.
4. Build/runtime code to the version-controlled content registry.

## Controls

- FastAPI validates identity before private routes and scopes every query by verified user ID.
- Teacher APIs additionally require the trusted `app_metadata.borza_role` claim; user-editable metadata cannot elevate a learner.
- Production rejects development demo headers.
- Direct `anon`/`authenticated` database access is revoked; RLS is enabled as defense in depth.
- Financial values use decimals and validated bounds.
- Quiz/review/simulator state transitions use explicit schemas and immutable history where appropriate.
- Pages set CSP, framing, MIME, permissions, and referrer headers.
- Structured content avoids arbitrary HTML execution; external source links are HTTPS validated.
- Local environment and Vercel metadata files are ignored by Git.
- Simulator code contains no broker integration and datasets are labelled simulated.

## Verification expectations

- User A cannot read or mutate User B’s state across every private resource type.
- Supabase secret/service-role patterns are absent from client bundles and tracked files.
- Clean and legacy-head migration paths both reach the Academy head without losing legacy rows.
- Content validation fails on missing translations, broken references, duplicate IDs, or non-authoritative sources.
- Browser tests cover auth-unconfigured states, keyboard navigation, chart summaries, themes, mobile overflow, and console errors.

## Known operational limitations

- The application rate limiter is process-local; production should enforce distributed/platform limits.
- Public classroom joins use a separate 120/minute bucket so a 100-person class can enter without weakening the 30/minute protection on mentor, practical-attempt, and partnership endpoints.
- The deterministic local practical-finance demo bundles authored scoring metadata in browser JavaScript; only authenticated server-scored evidence is authoritative.
- The current CSP still permits inline script/style execution for Next.js hydration and the pre-hydration preference bootstrap. Remove `unsafe-inline` through a reviewed nonce/hash design before broad public launch.
- Revoked Supabase sessions can remain valid until their short-lived access token expires depending on verification mode; sensitive operations should use appropriately short expiry and current session validation.
- Static automated scans complement but do not replace a dedicated penetration test before broad public launch.
