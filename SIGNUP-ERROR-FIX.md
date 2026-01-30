# Signup Error - "Failed to Fetch" - Complete Fix Guide

## ✅ Step 1: Code Deployed (DONE)

Just pushed code to GitHub → Vercel is deploying now.

**Commit:** `0ebc04d` - feat: implement dual signup flows

**What was deployed:**
- Fixed beta signup API
- Updated signup form
- Database schema migrations
- Beta account creation logic

---

## ⏳ Step 2: Wait for Vercel Deployment

**Check deployment status:**
👉 https://vercel.com/nadavyigal/running-coach-/deployments

**Wait for:**
- Green checkmark ✅
- "Ready" status
- Usually takes 2-3 minutes

---

## 🔑 Step 3: Verify Environment Variables in Vercel

This is **CRITICAL** - if these aren't set, you'll get "Failed to fetch":

### Check These Variables:

1. **Open Vercel Dashboard:**
   👉 https://vercel.com/nadavyigal/running-coach-/settings/environment-variables

2. **Verify these exist:**

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://dxqglotcyirxzyqaxqln.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **If missing, add them:**
   - Click "Add New"
   - Variable name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://dxqglotcyirxzyqaxqln.supabase.co`
   - Environment: Production, Preview, Development (select all)
   - Click "Save"

   Repeat for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`

4. **After adding variables:**
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"

---

## 🧪 Step 4: Test After Deployment

### Test Regular App Signup:

1. **Open your app:**
   👉 https://runsmart-ai.com

2. **Open browser DevTools:**
   - Press F12
   - Go to Console tab
   - Go to Network tab

3. **Click "Sign Up"**

4. **Fill form:**
   - Email: test@example.com
   - Password: TestPass123
   - Confirm password

5. **Click "Create Account"**

6. **Check for errors:**
   - Console tab: Look for red errors
   - Network tab: Look for failed requests

### Test Beta Signup:

1. **Open beta page:**
   👉 https://runsmart-ai.com/landing/beta-signup

2. **Fill and submit**

3. **Should work without errors**

---

## 🐛 Common Issues & Solutions

### Issue 1: "Failed to fetch"

**Cause:** Environment variables not set or Supabase URL/key is wrong

**Solution:**
1. Check Vercel environment variables (Step 3)
2. Verify keys match those in Supabase dashboard
3. Redeploy after fixing

**Check Supabase Keys:**
👉 https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/settings/api

### Issue 2: "new row violates row-level security policy"

**Cause:** RLS policies not allowing profile creation

**Solution:** Run this in Supabase SQL Editor:

```sql
-- Allow anon users to create profiles during signup
CREATE POLICY IF NOT EXISTS "Allow anon profile creation"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

### Issue 3: "relation profiles does not exist"

**Cause:** Migration wasn't run

**Solution:** Run `migrations/003-fix-beta-signups-schema.sql` in Supabase

### Issue 4: CORS Error

**Cause:** Supabase Auth configuration missing redirect URLs

**Solution:**
1. Go to: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/auth/url-configuration
2. Add redirect URLs:
   ```
   https://runsmart-ai.com/**
   https://runsmart-ai.com/auth/callback
   ```
3. Set Site URL: `https://runsmart-ai.com`

### Issue 5: Email Already Exists

**This is actually SUCCESS!** It means:
- Supabase connection works
- The user already exists
- Try a different email

---

## 📋 Debugging Checklist

### If signup still fails after deployment:

1. **Check Vercel Deployment Status**
   - [ ] Deployment shows "Ready" status
   - [ ] No build errors
   - [ ] Latest commit hash matches

2. **Check Environment Variables**
   - [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
   - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
   - [ ] Values match Supabase dashboard

3. **Check Supabase Tables**
   - [ ] `profiles` table exists
   - [ ] `beta_signups` table exists
   - [ ] Tables have correct columns

4. **Check RLS Policies**
   - [ ] Anon can INSERT into profiles
   - [ ] Anon can INSERT into beta_signups
   - [ ] No conflicting policies blocking access

5. **Check Browser Console**
   - [ ] No CORS errors
   - [ ] No 404 errors (wrong URL)
   - [ ] No 500 errors (server error)

---

## 🔍 How to Check Actual Error

### In Browser (Desktop):

1. Open DevTools (F12)
2. Go to **Console** tab
3. Try to sign up
4. Look for error messages (red text)
5. Copy error message

### In Mobile:

**Option 1: Use Remote Debugging**
1. Connect phone to computer via USB
2. Open Chrome on computer
3. Go to `chrome://inspect`
4. Select your device
5. Click "Inspect" on RunSmart
6. See console errors

**Option 2: Check Vercel Logs**
1. Go to Vercel dashboard
2. Click on latest deployment
3. Go to "Functions" tab
4. Look for error logs

---

## ✅ Success Looks Like

### Successful Signup:

**Console shows:**
```
[Signup] User created successfully: <uuid>
[Signup] Profile created successfully
```

**Network tab shows:**
- POST to Supabase auth (200 OK)
- POST to profiles table (201 Created)

**UI shows:**
- Success message
- "Check your email" (for app signup)
- Redirect to thank you page (for beta signup)

---

## 🆘 Still Not Working?

1. **Check Supabase Status:**
   👉 https://status.supabase.com

2. **Check Vercel Status:**
   👉 https://www.vercel-status.com

3. **Get Detailed Error:**
   - Open browser console
   - Copy the EXACT error message
   - Share it for debugging

4. **Check Vercel Function Logs:**
   - Go to Vercel dashboard
   - Click deployment
   - Go to "Functions" or "Logs" tab
   - Look for errors

---

## 🎯 Next Steps

1. ✅ Wait for Vercel deployment (2-3 minutes)
2. ✅ Verify environment variables are set
3. ✅ Clear browser cache (Ctrl+Shift+Delete)
4. ✅ Try signup again
5. ✅ Check browser console for errors

**If it works:** Great! Test both flows (app + beta)

**If it fails:** Follow debugging checklist above

---

## 📞 Quick Test Commands

### Test Supabase Connection (Browser Console):

```javascript
// Check if Supabase is configured
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING')
```

### Test Profile Creation (Supabase SQL Editor):

```sql
-- Try to insert a test profile
INSERT INTO profiles (
  auth_user_id,
  email,
  goal,
  experience,
  preferred_times,
  days_per_week,
  onboarding_complete,
  is_beta_user
)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  'habit',
  'beginner',
  ARRAY['morning'],
  3,
  false,
  false
);

-- If this works, RLS is configured correctly
```

---

**Most Likely Issue:** Environment variables not set in Vercel

**Quick Fix:** Add variables → Redeploy → Test
