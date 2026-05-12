# Security and Environment Standards

## Secrets
- Never commit `.env.local` or real secret values.
- Treat `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GARMIN_CLIENT_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, and webhook secrets as server-only.
- Only `NEXT_PUBLIC_*` values may be exposed to the browser, and only when intended.

## Auth and Privacy
- Do not expose another user's data.
- Check user identity before reading or writing user-owned Supabase data.
- For admin features, verify admin email logic and fallback behavior.
- Avoid logging personal health, location, or token data.

## AI Safety
- Training guidance should avoid overclaiming certainty.
- Include recovery and "listen to your body" context when advice affects training load.
- Handle missing or low-quality data honestly.

## Data Changes
- No destructive schema changes without migration, rollback notes, and data impact review.
- Review RLS policies for new tables or changed ownership assumptions.
- Sanitize user-provided content before rendering when relevant.
