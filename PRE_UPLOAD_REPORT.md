# RunSmart TestFlight Pre-Upload Report
**Date:** 2026-04-23  
**Status:** Ready for manual Xcode steps

---

## Summary

Most configuration was already correct. Three items were fixed/added in this session. One critical item (password reset emails) requires manual Supabase Dashboard configuration.

---

## What Was Fixed / Done

### 1. Capacitor Sync — DONE ✅
`npx cap sync ios` completed successfully from `/v0/`.

**6 Capacitor plugins synced:**
- `@capacitor-community/background-geolocation@1.2.26`
- `@capacitor/app@7.1.2`
- `@capacitor/geolocation@7.1.8`
- `@capacitor/keyboard@7.0.5`
- `@capacitor/share@7.0.4`
- `@capacitor/status-bar@7.0.5`

**No web build needed** — the iOS app is configured to load from the live server at `https://runsmart-ai.com` (`capacitor.config.ts` → `server.url`).

### 2. Universal Links AASA File — ADDED ✅
Created `v0/public/.well-known/apple-app-site-association` with:
- App ID: `8VC4R5M425.com.runsmart.coach`
- Paths: `/auth/callback`, `/auth/update-password`, `/`

Also added `Content-Type: application/json` header in `next.config.mjs` for this file.

**Effect:** After deploying, password reset email links will open directly in the iOS app rather than in Safari.

### 3. CORS Configuration Fix — FIXED ✅
`v0/lib/security.config.ts` was referencing `NEXT_PUBLIC_APP_URL` which is not set in any environment, causing production CORS origin to resolve to `''` (empty string).

**Fix:** Changed to fall back to `NEXT_PUBLIC_SITE_URL ?? 'https://runsmart-ai.com'` so the chat and other APIs correctly allow requests from the production domain.

### 4. iOS Project Configuration — ALREADY CORRECT ✅
No changes needed:
- **Bundle ID:** `com.runsmart.coach` ✅
- **Version:** `1.0.0` / Build `1` ✅
- **Info.plist permissions:** NSLocationWhenInUseUsageDescription, NSLocationAlwaysAndWhenInUseUsageDescription, NSLocationAlwaysUsageDescription, NSMotionUsageDescription ✅
- **Background Modes:** location, audio, fetch ✅
- **Launch Screen:** `LaunchScreen.storyboard` exists ✅
- **App Icon:** 1024×1024 universal icon present ✅ (Xcode 13+ accepts single universal size)
- **Entitlements:** `applinks:runsmart-ai.com` + location ✅

### 5. Demo Account — EXISTS ✅
- **Email:** `testflight@runsmart-ai.com`
- **Password:** `TestFlight2024!`
- Account is already confirmed (email_confirm: true)

---

## Critical: Needs Manual Intervention

### PASSWORD RESET EMAILS NOT SENDING ⛔ MUST FIX BEFORE TESTFLIGHT

**Root Cause:** Supabase Auth uses its built-in email service by default, which is rate-limited to **4 emails/hour** and unreliable for production. The password reset code itself is correct.

**The Fix (30 minutes):**

#### Step 1: Verify domain in Resend
1. Go to https://resend.com/domains
2. Add domain `runsmart-ai.com`
3. Add the DNS records Resend provides to your DNS provider (Cloudflare/Namecheap/etc.)
4. Wait for verification (usually < 5 minutes)

#### Step 2: Configure custom SMTP in Supabase
1. Go to https://supabase.com/dashboard → Project `dxqglotcyirxzyqaxqln`
2. Navigate to **Authentication → Email Settings → SMTP Settings**
3. Enable **Custom SMTP**
4. Enter:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** `<RESEND_API_KEY — see 1Password, do not commit>` (your Resend API key)
   - **Sender email:** `noreply@runsmart-ai.com`
   - **Sender name:** `RunSmart`
5. Save and send a test email

**Why Resend?** The app already has a Resend API key configured and the email.ts library uses `noreply@runsmart-ai.com` as the sender.

**Note:** The password reset code flow is correct:
- `supabase.auth.resetPasswordForEmail()` with `redirectTo: https://runsmart-ai.com/auth/callback?type=recovery`
- Callback exchanges the PKCE code and redirects to `/auth/update-password`
- Update password page calls `supabase.auth.updateUser({ password })`

---

## What Needs Manual Steps in Xcode

### 1. Deploy Web App Changes (before Xcode)
The AASA file and CORS fix need to be deployed to production first:
```bash
cd v0
git add public/.well-known/apple-app-site-association next.config.mjs lib/security.config.ts
git commit -m "feat: add AASA for universal links, fix CORS config"
git push  # triggers Vercel deploy
```

### 2. Code Signing (requires Apple Developer account)
1. Open Xcode: `open apps/ios/App/App.xcworkspace`
2. Select **App** target → **Signing & Capabilities**
3. Set **Team** to your Apple Developer account
4. Enable **Automatically manage signing**
5. Verify **Bundle Identifier** is `com.runsmart.coach`

### 3. Archive and Upload
1. Select **Any iOS Device (arm64)** as the build destination
2. **Product → Archive**
3. In Organizer, click **Distribute App**
4. Select **App Store Connect** → **Upload**
5. Follow the wizard

### 4. Add TestFlight Testers
1. Go to https://appstoreconnect.apple.com
2. Select RunSmart → **TestFlight**
3. Add internal testers or create external test group
4. Add `testflight@runsmart-ai.com` as an internal tester

---

## Backend Readiness

| Item | Status |
|------|--------|
| Supabase project | ✅ Connected (`dxqglotcyirxzyqaxqln`) |
| NEXT_PUBLIC_SUPABASE_URL | ✅ Set |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ Set |
| SUPABASE_SERVICE_ROLE_KEY | ✅ Set |
| OPENAI_API_KEY | ✅ Set |
| RESEND_API_KEY | ✅ Set |
| NEXT_PUBLIC_SITE_URL | ✅ `https://runsmart-ai.com` |
| Supabase Auth redirect URLs | ✅ Configured per SUPABASE-AUTH-CONFIGURATION.md |
| CORS origin | ✅ Fixed (was referencing unset NEXT_PUBLIC_APP_URL) |
| Password reset SMTP | ⛔ Needs Supabase custom SMTP config |
| PostHog API key | ⚠️ `NEXT_PUBLIC_POSTHOG_KEY` not set (analytics will be silent) |

---

## Files Changed in This Session

| File | Change |
|------|--------|
| `v0/public/.well-known/apple-app-site-association` | Created — Universal Links for iOS |
| `v0/next.config.mjs` | Added Content-Type header for AASA file |
| `v0/lib/security.config.ts` | Fixed CORS origin to use NEXT_PUBLIC_SITE_URL fallback |
| `v0/scripts/create-testflight-demo.ts` | Script to create/verify demo account |

---

## Quick Checklist Before Submitting

- [ ] Fix password reset: verify Resend domain + configure Supabase SMTP
- [ ] Deploy changes to production (git push)
- [ ] Verify AASA file is accessible: `curl https://runsmart-ai.com/.well-known/apple-app-site-association`
- [ ] Open Xcode → configure code signing
- [ ] Archive and upload to App Store Connect
- [ ] Add TestFlight testers
- [ ] Test demo account login: `testflight@runsmart-ai.com` / `TestFlight2024!`
- [ ] Test password reset end-to-end after SMTP is configured
