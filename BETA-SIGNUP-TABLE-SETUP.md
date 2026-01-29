# Beta Signup Table Setup Guide

## Issue
Beta signup form on `/landing/beta-signup` is failing with "Load failed" error because the `beta_signups` table doesn't exist in Supabase.

## Solution

### Step 1: Create the `beta_signups` table

**IMPORTANT**: Run the complete SQL migration in your Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/sql/new
2. Copy the entire contents of `migrations/001-create-beta-signups-table.sql`
3. Click "Run" to execute

Or run this SQL directly:

```sql
-- Create beta_signups table with all required columns
CREATE TABLE IF NOT EXISTS beta_signups (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  goals TEXT NOT NULL, -- JSON array stored as text (e.g., '["habit","race"]')
  hear_about_us TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_at TIMESTAMPTZ, -- When we sent beta invite
  converted_at TIMESTAMPTZ -- When they signed up for full account
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_beta_signups_email ON beta_signups(email);
CREATE INDEX IF NOT EXISTS idx_beta_signups_created_at ON beta_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_signups_invited_at ON beta_signups(invited_at) WHERE invited_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_beta_signups_converted_at ON beta_signups(converted_at) WHERE converted_at IS NOT NULL;
```

### Step 2: Configure RLS Policies

```sql
-- Enable Row Level Security
ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert (for signup form)
CREATE POLICY "Allow anonymous inserts"
  ON beta_signups
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated inserts"
  ON beta_signups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only allow service role to read/update/delete (for admin dashboard)
CREATE POLICY "Service role full access"
  ON beta_signups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Step 3: Verify Environment Variables in Vercel

Make sure these are set in your Vercel project settings:

1. Go to: https://vercel.com/your-project/settings/environment-variables

2. Verify these variables exist:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://dxqglotcyirxzyqaxqln.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key from SUPABASE-AUTH-CONFIGURATION.md)
   - `SUPABASE_SERVICE_ROLE_KEY` = (your service role key - keep this secret!)

3. After setting, **trigger a new deployment** or wait for auto-deploy

### Step 4: Test the Beta Signup Flow

#### On Web (Desktop/Mobile Browser)
1. Visit: https://runsmart-ai.com/landing/beta-signup
2. Fill out the form with test data:
   - Email: your-test-email@example.com
   - Experience: Beginner
   - Goals: Check "Build a consistent running habit"
   - Agree to terms: Check the box
3. Click "Join the Beta Waitlist"
4. Expected: You should be redirected to `/landing/beta-signup/thanks`

#### On Mobile (PWA)
1. Open RunSmart PWA on your mobile device
2. Navigate to Profile or Settings (if there's a link to beta signup)
3. Try the same flow

#### Verify in Supabase
1. Go to: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/editor
2. Select `beta_signups` table
3. You should see your test entry with:
   - email (the one you entered)
   - experience_level: 'beginner'
   - goals: '["habit"]'
   - hear_about_us: (whatever you selected)
   - created_at: (current timestamp)

#### Test Duplicate Prevention
1. Try submitting the same email again
2. Expected: Form should accept but return `created: false` (duplicate detection)
3. No new row should be created in Supabase

## Expected Behavior After Fix

- ✅ Users can submit beta signup form
- ✅ Data is saved to Supabase `beta_signups` table
- ✅ Duplicate emails are rejected gracefully
- ✅ Welcome email is sent (if email service is configured)

## Troubleshooting

### Still seeing "Load failed" error?

1. **Check Supabase logs**: Dashboard > Logs > API to see exact error
2. **Verify RLS policies**: Make sure `anon` role can INSERT
3. **Check browser console**: Open DevTools > Network tab and look for failed requests
4. **Test with service role key**: Temporarily use service role key to bypass RLS

### Error: "relation beta_signups does not exist"

The table wasn't created. Re-run the CREATE TABLE SQL from Step 1.

### Error: "new row violates row-level security policy"

RLS policies are too restrictive. Re-run the RLS policy SQL from Step 2.

## Related Files

- Beta signup form: `v0/app/landing/beta-signup/beta-signup-form.tsx`
- API route: `v0/app/api/beta-signup/route.ts`
- Repository: `v0/lib/server/betaSignupRepository.ts`

## Notes

This is **separate** from the user authentication signup flow. The beta signup is just for marketing/waitlist purposes.

If users want to actually use the app, they need to:
1. Complete onboarding (which creates local Dexie data)
2. Optionally create an account later (via the welcome modal or auth modal)
