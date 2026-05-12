# Supabase Standards

## Client Boundaries
- Browser components use `v0/lib/supabase/client.ts`.
- Server components and route handlers use server clients from `v0/lib/supabase/server*.ts`.
- Service role clients are server-only. Never import them into client components.

## Auth
- Use `getUser()` for trusted server-side auth checks.
- Keep admin routes protected by auth and `ADMIN_EMAILS`.
- Do not assume a user profile exists just because auth exists.

## Queries
- Use `.maybeSingle()` when zero rows are valid.
- Use `.single()` only when exactly one row must exist and failure is meaningful.
- Handle and surface errors without leaking private details.

## Migrations
- Prefer current app migrations under `v0/supabase/migrations/`.
- Include rollback notes for schema changes.
- Do not make breaking schema changes without a migration and a data/backfill plan.
- Review RLS for every new table or policy-affecting change.

## Environment
- Required public vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Required server secret for admin operations: `SUPABASE_SERVICE_ROLE_KEY`.
- Never commit real keys.
