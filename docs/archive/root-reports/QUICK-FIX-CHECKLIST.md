# Quick Fix Checklist - Beta Signup Issue

## The Problem
Beta signup form on production (https://runsmart-ai.com/landing/beta-signup) shows "Load failed" error on both web and mobile.

## Root Cause
The `beta_signups` table doesn't exist in Supabase database.

## Fix (5 minutes)

### ☐ Step 1: Run SQL Migration (2 min)
1. Open: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/sql/new
2. Copy ALL contents from `migrations/001-create-beta-signups-table.sql`
3. Paste and click "Run"
4. ✅ Should see: "Success. No rows returned"

### ☐ Step 2: Verify Table Created (30 sec)
1. Open: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/editor
2. Look for `beta_signups` in table list
3. ✅ Click on it - should show empty table with columns:
   - id, email, experience_level, goals, hear_about_us, created_at, invited_at, converted_at

### ☐ Step 3: Check Vercel Environment Variables (1 min)
1. Open: https://vercel.com/your-project/settings/environment-variables
2. ✅ Verify these exist and are not empty:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional but recommended)

### ☐ Step 4: Trigger Vercel Redeploy (30 sec)
> **NOTE**: If env vars are already set, you don't need to redeploy!
> Supabase changes take effect immediately.

If you changed env vars:
1. Go to: https://vercel.com/your-project/deployments
2. Click "..." on latest deployment > "Redeploy"
3. Wait for deployment to finish (~2 min)

### ☐ Step 5: Test on Production (1 min)
1. **Clear browser cache** or use incognito mode
2. Visit: https://runsmart-ai.com/landing/beta-signup
3. Fill form and submit
4. ✅ Should redirect to: https://runsmart-ai.com/landing/beta-signup/thanks
5. ✅ Check Supabase table editor - new row should appear

### ☐ Step 6: Test on Mobile (1 min)
1. Open RunSmart on your mobile device
2. Navigate to the beta signup page
3. Fill form and submit
4. ✅ Should work the same as web

## If Still Failing

### Check Supabase Logs
1. Go to: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/logs/api-logs
2. Filter by "POST /rest/v1/beta_signups"
3. Look for error messages

### Check Browser Console
1. Open DevTools (F12)
2. Go to Network tab
3. Submit form
4. Look for failed requests to `/api/beta-signup`
5. Click on the request > Response tab to see error

### Common Errors

| Error Message | Solution |
|---------------|----------|
| "relation beta_signups does not exist" | Re-run Step 1 SQL migration |
| "new row violates row-level security policy" | Re-run RLS policies from migration |
| "Failed to fetch" / "Network error" | Check Vercel env vars, redeploy |
| "email already exists" / "duplicate key" | Working correctly! (duplicate prevention) |

## Success Criteria
✅ Beta signup form submits without errors
✅ Users are redirected to thank you page  
✅ Data appears in `beta_signups` table
✅ Duplicate emails are handled gracefully
✅ Works on both web and mobile

## Time Estimate
- If table doesn't exist: **5 minutes** (run migration + test)
- If env vars missing: **8 minutes** (add vars, redeploy, test)
- If other issue: **15 minutes** (check logs, debug)

## Need Help?
Refer to detailed guide: `BETA-SIGNUP-TABLE-SETUP.md`

## Related Commit
Commit 7ecd1a1 fixed the `profiles` table for user authentication, but didn't create the `beta_signups` table for the waitlist signup form. This is a separate table that also needs to be created.
