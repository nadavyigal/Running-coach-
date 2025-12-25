# Supabase Authentication Configuration Guide

## Complete URL Configuration for Run-Smart

This guide will help you configure Supabase authentication for your Run-Smart application.

---

## Step 1: Configure Redirect URLs in Supabase Dashboard

### Access the Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `dxqglotcyirxzyqaxqln`
3. Navigate to: **Authentication** → **URL Configuration**

### Add Redirect URLs

Click "Add new redirect URLs" and add the following URLs **one at a time**:

#### Production URLs
```
https://runsmart-ai.com/**
https://runsmart-ai.com/auth/callback
```

#### Local Development URLs
```
http://localhost:3000/**
http://localhost:3000/auth/callback
```

**What these URLs do:**
- `https://runsmart-ai.com/**` - Allows any page on your production site to handle auth
- `https://runsmart-ai.com/auth/callback` - Specific callback route for email confirmations
- `http://localhost:3000/**` - For testing on your local machine
- `http://localhost:3000/auth/callback` - Local callback for development

After adding all URLs, click **"Save URLs"**

---

## Step 2: Set Site URL

In the same URL Configuration section, find the **"Site URL"** field.

Set it to:
```
https://runsmart-ai.com
```

This is your main domain where users land after auth actions.

Click **"Save"**

---

## Step 3: Configure Email Templates (Optional but Recommended)

Navigate to: **Authentication** → **Email Templates**

### Update Confirmation Email Template

Replace the default confirmation link with:
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
```

This ensures email confirmations redirect through your callback route.

---

## Step 4: Verify Environment Variables

Your `.env.local` file should contain:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://dxqglotcyirxzyqaxqln.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_PpDpqkqVaKFnOyoLR7mdyA_UNTeeoqN
SUPABASE_SERVICE_ROLE_KEY=sb_secret_ogT13ZixPFyvzPQxEWrFiA_I_DoOJ1W

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://runsmart-ai.com
```

**✅ These are already configured in your project!**

---

## Step 5: Verify Code Implementation

### Auth Callback Route
**Location:** `app/auth/callback/route.ts`

✅ **Already created and configured!**

### Supabase Client Utilities
**Location:** `lib/supabase/`

✅ **Browser client:** `lib/supabase/client.ts`
✅ **Server client:** `lib/supabase/server.ts`

---

## Step 6: Test the Configuration

### Test Email Authentication

1. Start your development server:
   ```bash
   cd v0
   npm run dev
   ```

2. Navigate to your auth page (if you have one)

3. Try signing up with an email

4. Check your email for the confirmation link

5. Click the link - it should redirect to:
   ```
   http://localhost:3000/auth/callback?code=...
   ```

6. After successful auth, you should be redirected to the home page

### Test in Production

1. Deploy your changes to Vercel

2. Test the same flow on `https://runsmart-ai.com`

---

## Common Issues and Solutions

### Issue: "Invalid redirect URL"
**Solution:** Make sure you've added the exact URLs (including wildcards) in Supabase dashboard

### Issue: "Email not confirmed"
**Solution:** Check that your email template uses the correct callback URL format

### Issue: Cookies not being set
**Solution:** Ensure your domain is configured correctly and using HTTPS in production

### Issue: Authentication works locally but not in production
**Solution:**
- Verify production URLs are added to Supabase
- Check that `NEXT_PUBLIC_SITE_URL` matches your production domain
- Ensure environment variables are set in Vercel

---

## Security Checklist

- ✅ Anon key is public-safe (only for client-side)
- ✅ Service role key is kept secret (never exposed to client)
- ✅ Redirect URLs are explicitly whitelisted
- ✅ Site URL matches your production domain
- ✅ HTTPS is enforced in production

---

## Testing Checklist

After configuration, test these flows:

- [ ] Sign up with email (local)
- [ ] Email confirmation click (local)
- [ ] Sign in with email (local)
- [ ] Sign out (local)
- [ ] Sign up with email (production)
- [ ] Email confirmation click (production)
- [ ] Sign in with email (production)
- [ ] Sign out (production)

---

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js with Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

---

## Need Help?

If you encounter issues:
1. Check Supabase logs in Dashboard → Authentication → Logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure you're using the latest `@supabase/ssr` package

**Current package version:** Check `package.json` for `@supabase/ssr` and `@supabase/supabase-js`
