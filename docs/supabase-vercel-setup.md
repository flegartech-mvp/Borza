# Supabase Auth, PostgreSQL, and Vercel Setup

## Supabase project

Borza Academy can use one Supabase project for PostgreSQL and email authentication. Configure allowed site/redirect URLs for local development and the final Vercel hostname. Configure production SMTP before relying on branded recovery email.

Use current publishable keys. Never expose a secret or `service_role` key to the browser.

## Backend

Set on Render/API only:

```env
ENVIRONMENT=production
DATABASE_URL=postgresql+psycopg://...
MIGRATION_DATABASE_URL=postgresql+psycopg://...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
ACADEMY_ALLOW_DEMO_AUTH=false
CORS_ORIGINS=https://<frontend>.vercel.app
ALLOWED_HOSTS=<backend-host>
```

Use a direct/session connection for Alembic where required and a supported pooler URL for runtime. Apply migrations before API traffic reaches the new release.

The API validates user tokens through Supabase Auth and uses its own database connection. Browser clients do not need direct access to Academy tables.

## Frontend

Set on Vercel:

```env
NEXT_PUBLIC_API_URL=https://<backend-host>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

The `NEXT_PUBLIC_` names are intentionally browser-visible. They must never contain a secret/service-role key.

## Database access controls

Academy migrations revoke Data API privileges from `anon` and `authenticated` and enable RLS on user-owned tables as defense in depth. FastAPI’s database role must retain the grants required for server operations.

If direct Data API access is added later, create narrow owner policies using `auth.uid() = user_id`, include both `USING` and `WITH CHECK` for updates, and verify each policy with two users. Do not grant access merely to the `authenticated` role without an ownership predicate.

## Verification

1. Register a disposable account and complete email confirmation if enabled.
2. Sign in and confirm the browser receives a session.
3. Call one private API route and verify a learner row is created.
4. Create a note/progress/journal record as User A.
5. Confirm User B receives not found for User A’s resource IDs.
6. Sign out locally and confirm protected writes fail.
7. Run Supabase security advisors and review migrations before launch.
