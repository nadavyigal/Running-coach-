# Technical Risks

## High Attention
- Supabase schema changes can break auth, sync, Garmin, analytics, or plan data. Use migrations with rollback notes.
- `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, Garmin secrets, Resend keys, and cron secrets must remain server-only.
- Passing `npm run type-check` does not guarantee all non-core or excluded code is type-safe.
- Vercel cron and environment differences can make local success diverge from production.

## Product/UX Risks
- Today can become overloaded if every metric is promoted equally.
- AI explanations can overpromise certainty. Training advice should include recovery and safety context.
- Garmin and future Apple Health data can create conflicting signals unless data quality is surfaced.

## Engineering Risks
- There are many historical docs and implementation reports. Agents should avoid treating stale docs as current truth without checking code.
- There are multiple migration folders. Prefer `v0/supabase/migrations/` for current app migrations unless the task says otherwise.
- Local-first and cloud sync paths can diverge.
- Debug routes and scripts can leak implementation details if deployed without review.

## Mitigations
- Use small stories with explicit validation.
- For schema work, include migration, rollback notes, RLS review, and Supabase integration check.
- For UI work, run a mobile viewport check.
- For production changes, run local gates and review Vercel env/deploy assumptions.
