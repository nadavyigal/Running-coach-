# Complete Signup Flows Guide

## Overview

RunSmart has **two separate signup flows** with different purposes and behaviors:

1. **Beta Signup** (`/landing/beta-signup`) - Marketing/waitlist that creates full accounts
2. **Application Signup** (Auth Modal) - Direct account creation for app users

## Business Logic

### Beta Signup → Full Account
✅ Creates `beta_signups` entry  
✅ Creates Supabase Auth user  
✅ Creates `profiles` entry  
✅ Links all three together  
✅ Marks user as `is_beta_user: true`  
✅ Grants premium trial (90 days)  
✅ Auto-confirms email

**Why?** Beta users should get immediate access without extra signup steps.

### Application Signup → Regular Account
✅ Creates Supabase Auth user  
✅ Creates `profiles` entry  
❌ Does NOT create `beta_signups` entry  
✅ Marks user as `is_beta_user: false`  
✅ Standard trial (14 days)  
✅ Requires email confirmation

**Why?** Regular users who find the app shouldn't be on the beta waitlist.

---

## Database Schema

### Table: `beta_signups`
Marketing/waitlist signups with optional account linkage.

```sql
CREATE TABLE beta_signups (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  experience_level TEXT NOT NULL,
  goals TEXT NOT NULL,
  hear_about_us TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Account linkage (populated when account is created)
  auth_user_id UUID UNIQUE REFERENCES auth.users(id),
  profile_id BIGINT,
  converted_at TIMESTAMPTZ,
  
  -- Invite tracking
  invited_at TIMESTAMPTZ
);
```

### Table: `profiles`
Application user profiles (one per authenticated user).

```sql
CREATE TABLE profiles (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  email TEXT NOT NULL,
  
  -- Onboarding data
  goal TEXT,
  experience TEXT,
  preferred_times TEXT[],
  days_per_week INTEGER,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  
  -- Beta user tracking
  is_beta_user BOOLEAN DEFAULT FALSE,
  beta_signup_id BIGINT REFERENCES beta_signups(id),
  
  -- Subscription
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'trial',
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Implementation

### Beta Signup API (`/api/beta-signup`)

**File:** `v0/app/api/beta-signup/route.ts`

**What it does:**
1. Validates form data (email, experience, goals)
2. Calls `createBetaSignup()` with `createUserAccount: true`
3. Returns success + user IDs

**Code flow:**
```typescript
const result = await createBetaSignup({
  email: normalizedEmail,
  experienceLevel,
  goals: goalsString,
  hearAboutUs: hearAboutUsValue,
  createUserAccount: true, // ← KEY FLAG
})
```

### Beta Signup Repository

**File:** `v0/lib/server/betaSignupRepository.ts`

**Function:** `createBetaSignupWithAccount()`

**Steps:**
1. Check if beta signup already exists with account
2. Create Supabase Auth user (auto-confirmed)
3. Create profile with `is_beta_user: true`
4. Link beta_signups → auth_user_id & profile_id
5. Set `converted_at` timestamp

### Application Signup Form

**File:** `v0/components/auth/signup-form.tsx`

**What it does:**
1. Creates Supabase Auth user (requires email confirmation)
2. Creates profile with `is_beta_user: false`
3. Does NOT touch `beta_signups` table

---

## Setup Instructions

### Step 1: Run Database Migration

1. Go to: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/sql/new
2. Copy entire contents of `migrations/002-complete-signup-schema.sql`
3. Click "Run"
4. Verify both tables exist in Table Editor

### Step 2: Verify Environment Variables

Ensure these are set in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dxqglotcyirxzyqaxqln.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**IMPORTANT:** `SUPABASE_SERVICE_ROLE_KEY` is REQUIRED for beta signups to create users via admin API.

### Step 3: Deploy

Push changes to GitHub → Vercel auto-deploys

---

## Testing

### Test Beta Signup Flow

1. **Visit:** https://runsmart-ai.com/landing/beta-signup
2. **Fill form:**
   - Email: test-beta@example.com
   - Experience: Beginner
   - Goals: Check "Build running habit"
   - Agree to terms
3. **Submit** → Should redirect to `/landing/beta-signup/thanks`

4. **Verify in Supabase:**

   **beta_signups table:**
   ```sql
   SELECT email, auth_user_id, profile_id, converted_at 
   FROM beta_signups 
   WHERE email = 'test-beta@example.com';
   ```
   ✅ Should have `auth_user_id`, `profile_id`, and `converted_at` filled

   **profiles table:**
   ```sql
   SELECT email, is_beta_user, subscription_tier, trial_end_date
   FROM profiles
   WHERE email = 'test-beta@example.com';
   ```
   ✅ Should show `is_beta_user: true`, `subscription_tier: premium`, 90-day trial

   **auth.users table:**
   ```sql
   SELECT email, email_confirmed_at
   FROM auth.users
   WHERE email = 'test-beta@example.com';
   ```
   ✅ Should show email auto-confirmed

### Test Application Signup Flow

1. **Visit:** https://runsmart-ai.com (main app)
2. **Click:** "Sign Up" or open auth modal
3. **Fill form:**
   - Email: test-app@example.com
   - Password: TestPass123
   - Confirm password
4. **Submit** → Should show success + email confirmation message

5. **Verify in Supabase:**

   **profiles table:**
   ```sql
   SELECT email, is_beta_user, subscription_tier
   FROM profiles
   WHERE email = 'test-app@example.com';
   ```
   ✅ Should show `is_beta_user: false`, `subscription_tier: free`

   **beta_signups table:**
   ```sql
   SELECT * FROM beta_signups 
   WHERE email = 'test-app@example.com';
   ```
   ✅ Should return NO ROWS (app signups don't create beta entries)

---

## Troubleshooting

### Beta Signup Fails

**Error:** "Failed to create auth user"

**Solution:** Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel environment variables.

**Check:**
```bash
# In Vercel dashboard
vercel env ls
```

### Profile Creation Fails

**Error:** "new row violates row-level security policy"

**Solution:** Ensure RLS policy allows anon inserts:
```sql
CREATE POLICY "Allow anon profile creation"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

### Beta User Can't Login

**Issue:** Beta user created but can't login

**Cause:** Temporary password is set but user doesn't know it

**Solution:** Send password reset email:
```typescript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
})
```

Or auto-login after beta signup using the admin session token.

---

## Migration Checklist

- [x] Created `migrations/002-complete-signup-schema.sql`
- [x] Added `beta_signups` table with account linkage columns
- [x] Added `profiles` table with beta user tracking
- [x] Created RLS policies for both tables
- [x] Added `createBetaSignupWithAccount()` function
- [x] Updated beta signup API to pass `createUserAccount: true`
- [x] Updated app signup form to set `is_beta_user: false`
- [x] Added `email` column to profiles table
- [ ] Run migration in Supabase (DO THIS NOW!)
- [ ] Test beta signup flow
- [ ] Test app signup flow

---

## Key Files Modified

1. `migrations/002-complete-signup-schema.sql` - Complete database schema
2. `v0/lib/server/betaSignupRepository.ts` - Beta signup logic with account creation
3. `v0/app/api/beta-signup/route.ts` - API endpoint with createUserAccount flag
4. `v0/components/auth/signup-form.tsx` - App signup with is_beta_user: false

---

## Important Notes

1. **Beta users get premium:** 90-day trial vs 14-day for regular users
2. **Beta emails auto-confirmed:** No email verification step
3. **One-way conversion:** Beta → Account is automatic, Account → Beta is manual
4. **Temporary passwords:** Beta users get random passwords (send reset link)
5. **Service role required:** Admin API needs service role key for user creation

---

## Next Steps

1. ✅ Run the migration SQL
2. ✅ Deploy to Vercel
3. Test both flows thoroughly
4. Consider sending welcome email with password reset link to beta users
5. Add admin dashboard to view beta signups and conversion rates

---

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs → API
2. Check browser console for client errors
3. Verify RLS policies allow necessary operations
4. Ensure service role key is set for production

For questions, refer to:
- `BETA-SIGNUP-TABLE-SETUP.md` - Original beta signup setup
- `SUPABASE-AUTH-CONFIGURATION.md` - Auth configuration guide
