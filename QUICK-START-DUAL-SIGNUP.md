# Quick Start: Dual Signup Implementation

## What Was Implemented

✅ **Two separate signup flows:**
1. **Beta Signup** → Creates `beta_signups` + Auth user + `profiles` (premium 90-day trial)
2. **App Signup** → Creates Auth user + `profiles` only (standard 14-day trial)

✅ **Business logic:**
- Beta signup = Instant full account access
- App signup = Regular flow, NOT added to beta list

## 🚀 Setup (5 minutes)

### Step 1: Run Database Migration

**Open Supabase SQL Editor:**
https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/sql/new

**Run this command:**
```sql
-- Copy ENTIRE contents from migrations/002-complete-signup-schema.sql
-- Then click "Run"
```

Or copy/paste this complete SQL:

```sql
-- See migrations/002-complete-signup-schema.sql for full SQL
-- (File is ~250 lines, includes tables, indexes, RLS policies, triggers)
```

### Step 2: Verify Environment Variables in Vercel

**CRITICAL:** Service role key is REQUIRED for beta signups

```env
NEXT_PUBLIC_SUPABASE_URL=https://dxqglotcyirxzyqaxqln.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>  ← REQUIRED!
```

Check: https://vercel.com/your-project/settings/environment-variables

### Step 3: Deploy

```bash
git add .
git commit -m "feat: implement dual signup flows (beta + app)"
git push origin main
```

Vercel will auto-deploy in ~2 minutes.

---

## 🧪 Testing

### Test 1: Beta Signup (Creates Full Account)

1. Visit: https://runsmart-ai.com/landing/beta-signup
2. Fill form with test email
3. Submit → Should redirect to `/thanks` page
4. **Check Supabase:**
   - `beta_signups` table: Should have entry with `auth_user_id`, `profile_id`, `converted_at`
   - `profiles` table: Should show `is_beta_user: true`, `subscription_tier: premium`
   - `auth.users` table: Email auto-confirmed

### Test 2: App Signup (Regular Account)

1. Visit: https://runsmart-ai.com
2. Click "Sign Up" button
3. Fill form with email + password
4. Submit → Should show "Check your email" message
5. **Check Supabase:**
   - `profiles` table: Should show `is_beta_user: false`, `subscription_tier: free`
   - `beta_signups` table: Should have NO ENTRY for this email

---

## 📁 Files Changed

1. ✅ `migrations/002-complete-signup-schema.sql` - Complete DB schema
2. ✅ `v0/lib/server/betaSignupRepository.ts` - Added `createBetaSignupWithAccount()`
3. ✅ `v0/app/api/beta-signup/route.ts` - Passes `createUserAccount: true`
4. ✅ `v0/components/auth/signup-form.tsx` - Sets `is_beta_user: false`
5. ✅ `SIGNUP-FLOWS-COMPLETE-GUIDE.md` - Full documentation

---

## ⚡ Key Features

### Beta Users Get:
- ✅ Auto-confirmed email (no verification step)
- ✅ Premium subscription tier
- ✅ 90-day trial (vs 14 days)
- ✅ `is_beta_user: true` flag in profile
- ✅ Linked to `beta_signups` table

### Regular Users Get:
- ✅ Email verification required
- ✅ Free subscription tier
- ✅ 14-day trial
- ✅ `is_beta_user: false` flag
- ✅ NOT in `beta_signups` table

---

## 🔍 Verification Queries

Run these in Supabase SQL Editor to check everything works:

```sql
-- View all beta signups with accounts
SELECT 
  bs.email,
  bs.experience_level,
  bs.converted_at,
  p.is_beta_user,
  p.subscription_tier,
  p.onboarding_complete
FROM beta_signups bs
LEFT JOIN profiles p ON bs.profile_id = p.id
WHERE bs.auth_user_id IS NOT NULL
ORDER BY bs.created_at DESC;

-- View all regular app signups (not beta)
SELECT 
  email,
  experience,
  goal,
  subscription_tier,
  created_at
FROM profiles
WHERE is_beta_user = FALSE
ORDER BY created_at DESC;

-- Count signups by type
SELECT 
  'Beta Users' as type,
  COUNT(*) as count
FROM profiles
WHERE is_beta_user = TRUE
UNION ALL
SELECT 
  'Regular Users' as type,
  COUNT(*) as count
FROM profiles
WHERE is_beta_user = FALSE;
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Beta signup fails | Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel |
| "relation beta_signups does not exist" | Run Step 1 migration SQL |
| "row violates RLS policy" | Re-run RLS policies from migration |
| Beta user can't login | Send password reset email (temp password set) |
| App signup not setting `is_beta_user` | Check `signup-form.tsx` line 100 |

---

## 📚 Documentation

- **Complete Guide:** `SIGNUP-FLOWS-COMPLETE-GUIDE.md`
- **Migration SQL:** `migrations/002-complete-signup-schema.sql`
- **Original Beta Setup:** `BETA-SIGNUP-TABLE-SETUP.md`

---

## ✨ What's Next?

1. ✅ Run migration (Step 1 above)
2. ✅ Deploy to Vercel
3. Test both flows thoroughly
4. Consider: Send welcome email to beta users with password reset link
5. Consider: Admin dashboard to track beta conversions
6. Consider: Auto-login beta users after signup (skip password reset)

---

## 🎯 Success Criteria

- ✅ Beta signup creates entry in both `beta_signups` AND `profiles`
- ✅ App signup creates entry in `profiles` only
- ✅ Beta users marked with `is_beta_user: true`
- ✅ Regular users marked with `is_beta_user: false`
- ✅ Beta users get 90-day premium trial
- ✅ Regular users get 14-day free trial
- ✅ No errors in Supabase logs
- ✅ Works on both web and mobile

---

**Ready to deploy!** Just run the migration SQL and push to GitHub.
