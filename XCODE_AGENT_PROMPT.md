# 🍎 Xcode Agent Prompt — RunSmart TestFlight Upload

Copy and paste everything below this line into your Xcode AI agent.

---

## CONTEXT

I have a Capacitor-based iOS app called **RunSmart** that is ready for TestFlight upload. The web/backend work is complete and deployed to production at `https://runsmart-ai.com`.

**Project details:**
- Xcode workspace: `apps/ios/App/App.xcworkspace` (ALWAYS open the `.xcworkspace`, NOT `.xcodeproj`)
- Bundle ID: `com.runsmart.coach`
- App name: RunSmart
- Version: 1.0.0 / Build: 1
- Apple Team ID: `8VC4R5M425`
- Development Team: already set in project.pbxproj

**What has already been done (do NOT redo these):**
- ✅ Info.plist has all required permission strings (Location, Motion, Background Modes)
- ✅ Bundle ID, version 1.0.0, build 1 — all set in project.pbxproj
- ✅ LaunchScreen.storyboard exists
- ✅ App icon (1024×1024 universal) is present
- ✅ Capacitor sync completed (6 plugins)
- ✅ Universal Links entitlement: `applinks:runsmart-ai.com`
- ✅ Production server is live at `https://runsmart-ai.com`

---

## YOUR TASKS

### TASK 1: ONE CRITICAL MANUAL STEP BEFORE YOU START — Supabase SMTP

**Before doing anything in Xcode**, the password reset emails need to be fixed. This requires a browser action:

1. Open: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/auth/smtp
2. Enable **Custom SMTP**
3. Enter these exact values:
   - **Sender name:** `RunSmart`
   - **Sender email:** `noreply@runsmart-ai.com`
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** `<RESEND_API_KEY — see 1Password, do not commit>`
4. Click **Save** then **Send test email** to verify
5. ✅ Domain `runsmart-ai.com` is already verified in Resend — no DNS changes needed

---

### TASK 2: Open Project and Verify Signing

```bash
open apps/ios/App/App.xcworkspace
```

In Xcode:
1. Select the **App** target (not CapApp-SPM)
2. Go to **Signing & Capabilities** tab
3. Set **Team** to your Apple Developer account (Team ID: `8VC4R5M425`)
4. Enable **Automatically manage signing**
5. Verify **Bundle Identifier** shows `com.runsmart.coach`
6. Confirm Xcode generates a provisioning profile (no red errors)

**If signing fails:**
- Check you're logged in: Xcode → Settings → Accounts → add Apple ID if needed
- The app uses Universal Links (applinks:runsmart-ai.com) — the entitlement is already in `App.entitlements`, just ensure code signing picks it up

---

### TASK 3: Verify Build Settings

In **Build Settings** for the App target, confirm:
- `PRODUCT_BUNDLE_IDENTIFIER` = `com.runsmart.coach`
- `MARKETING_VERSION` = `1.0.0`
- `CURRENT_PROJECT_VERSION` = `1`
- `DEVELOPMENT_TEAM` = `8VC4R5M425`

If any are wrong, fix them now.

---

### TASK 4: Clean Build and Verify No Errors

1. **Product → Clean Build Folder** (Shift+Cmd+K)
2. Select destination: **Any iOS Device (arm64)** — NOT a simulator
3. **Product → Build** (Cmd+B)
4. Fix any build errors before proceeding. Common issues:
   - Missing provisioning profile → check signing settings
   - Swift package resolution errors → File → Packages → Resolve Package Versions
   - Background Geolocation plugin errors → may need `pod install` in `apps/ios/App/`

**DO NOT proceed to archive if there are build errors.**

---

### TASK 5: Archive the App

1. Destination must be **Any iOS Device (arm64)** (physical device, not simulator)
2. **Product → Archive**
3. Wait for archive to complete (2-5 minutes)
4. Xcode Organizer opens automatically

---

### TASK 6: Upload to App Store Connect

In the Xcode Organizer:
1. Select the RunSmart archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Choose **Upload** (not Export)
5. Options to keep enabled:
   - ✅ Include bitcode for iOS content (if available)
   - ✅ Upload your app's symbols
   - ✅ Manage Version and Build Number (let Xcode handle it)
6. Choose **Automatically manage signing**
7. Click **Upload**
8. Wait for upload (2-10 minutes depending on connection)

**If upload fails with "No accounts":** Xcode → Settings → Accounts → sign in with your Apple ID

---

### TASK 7: Configure TestFlight in App Store Connect

After upload (wait 5-15 minutes for Apple to process):

1. Go to https://appstoreconnect.apple.com
2. Select **RunSmart** app (or create it if first time)
3. Navigate to **TestFlight** tab
4. Find build 1.0.0 (1) — it may show "Processing" for a few minutes

**Add internal testers:**
- Go to **Internal Testing** → create group "Internal Testers"
- Add your Apple ID as tester
- Add `testflight@runsmart-ai.com` (demo account)

**For external testers (optional, needs Apple review):**
- Create an **External Testing** group
- Add testers by email
- Submit for Beta App Review (fill in test notes)

---

### TASK 8: Test the App on Device

Once you receive the TestFlight invite email:
1. Install TestFlight app on your iPhone (if not installed)
2. Open the TestFlight invite link
3. Install RunSmart

**Test these flows:**
- [ ] App opens and loads `https://runsmart-ai.com` (no blank/error screen)
- [ ] Sign up with a new account
- [ ] Login with demo account: `testflight@runsmart-ai.com` / `TestFlight2024!`
- [ ] Password reset: request reset email → check inbox → click link → set new password
- [ ] Onboarding flow completes
- [ ] GPS tracking starts (grant location permission when prompted)
- [ ] Background GPS works (lock phone during run)
- [ ] AI coach chat responds

---

### TASK 9: Verify Universal Links (Deep Links)

After app is installed from TestFlight:
1. Open Mail app and tap the password reset email link
2. It should open RunSmart app directly (not Safari)
3. If it opens Safari instead, Universal Links may need Apple's CDN to fetch AASA — wait 24 hours and retry after first install

---

## KNOWN ISSUES AND SOLUTIONS

### Issue: "Missing Push Notification Entitlement"
Not blocking for TestFlight. Can be added later.

### Issue: "Invalid Bundle — App contains embedded frameworks"
Usually a Capacitor plugin issue. Clean build folder and rebuild.

### Issue: Build fails with Swift Package Manager errors
Run in terminal:
```bash
cd apps/ios/App
xcodebuild -resolvePackageDependencies -workspace App.xcworkspace -scheme App
```

### Issue: Background geolocation plugin compile error
The `@capacitor-community/background-geolocation@1.2.26` plugin is included. If it errors, check the CapApp-SPM package references.

### Issue: "This app has crashed" on launch
Check Xcode console output. Likely causes:
- Missing `NEXT_PUBLIC_SUPABASE_URL` (but app loads from live server so this shouldn't matter)
- WebView failed to load `https://runsmart-ai.com` — check internet connectivity

---

## QUICK REFERENCE

| Item | Value |
|------|-------|
| Bundle ID | `com.runsmart.coach` |
| Version | `1.0.0` |
| Build | `1` |
| Team ID | `8VC4R5M425` |
| Server URL | `https://runsmart-ai.com` |
| Demo login | `testflight@runsmart-ai.com` / `TestFlight2024!` |
| Supabase project | `dxqglotcyirxzyqaxqln` |
| Supabase SMTP URL | https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/auth/smtp |

---

## EXPECTED TIMELINE

| Step | Time |
|------|------|
| Supabase SMTP setup | 5 min |
| Xcode signing setup | 5-10 min |
| Clean + Build | 3-5 min |
| Archive | 3-5 min |
| Upload | 5-10 min |
| Apple processing | 10-30 min |
| TestFlight install | 2 min |
| **Total** | **~45-60 min** |

---

## DONE ✅

When you've completed all tasks, the app should be available in TestFlight. Share the TestFlight link with beta testers.

**Next steps after TestFlight:**
1. Collect feedback from testers
2. Fix any reported bugs
3. Increment build number for each new build: change `CURRENT_PROJECT_VERSION` from `1` to `2`, etc.
4. When ready for App Store submission: Product → Archive → Distribute → App Store Connect → Submit for Review
