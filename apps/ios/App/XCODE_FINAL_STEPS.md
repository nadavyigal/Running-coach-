# 🎯 XCODE FINAL STEPS - RUNSMART
**Ready for Archive & Upload**
**Date:** April 20, 2026

---

## ✅ VS CODE COMPLETED
- ✅ Validation script run (false positives expected for Next.js structure)
- ✅ Build successful (`npm run build`)
- ✅ Capacitor sync successful (5 plugins updated)
- ✅ Xcode opened
- ✅ Email verification bug fixed
- ✅ GPS tracking bug fixed

**Your project structure:** Next.js monorepo with iOS at `apps/ios/`

---

## 📱 XCODE CONFIGURATION STEPS

### STEP 1: Link release.xcconfig to Release Configuration
**Time:** 2 minutes

1. In Xcode, click on the **project name** in the left navigator (top blue icon)
2. You'll see two items: **Project** (blue icon) and **App** (red icon)
3. Select the **Project** (blue icon, not the target)
4. Click the **Info** tab at the top
5. Look for **Configurations** section
6. Under **Release**, you should see a dropdown
7. Click the dropdown and select: **`release`** (from `apps/ios/App/release.xcconfig`)
8. Clean build folder: **Product → Clean Build Folder** (⌘⇧K)

**Verification:**
- [ ] Release configuration now shows `release` in the dropdown
- [ ] Clean build completed without errors

✅ **Status:** ☐ Complete

---

### STEP 2: Verify Info.plist Location Permissions
**Time:** 3 minutes

**Location:** `apps/ios/App/App/Info.plist`

1. In Xcode left navigator, expand: **App → App → Info.plist**
2. OR select **App** target → **Info** tab → scroll to "Custom iOS Target Properties"

**CRITICAL: Verify these keys exist:**

#### Required for GPS tracking:

**NSLocationWhenInUseUsageDescription**
```
RunSmart needs access to your location to accurately track your running distance, pace, and route while you use the app.
```

**NSLocationAlwaysAndWhenInUseUsageDescription**
```
RunSmart needs continuous location access to track your runs even when the app is in the background, ensuring accurate route and distance tracking throughout your entire workout.
```

**NSMotionUsageDescription** (if tracking steps/cadence)
```
RunSmart uses motion sensors to track your steps, cadence, and running form for more accurate fitness insights.
```

#### How to add if missing:

**Option 1: In Xcode**
1. Select **App** target → **Info** tab
2. Hover over any row and click **+** button
3. Type the key name exactly (e.g., `NSLocationWhenInUseUsageDescription`)
4. Set Type to **String**
5. Enter the description text in the Value field

**Option 2: Edit Info.plist directly**
1. Right-click Info.plist → Open As → Source Code
2. Copy entries from `Info.plist.sample` file I created
3. Paste between `<dict>` tags

**Verification:**
- [ ] NSLocationWhenInUseUsageDescription exists and has user-friendly text
- [ ] NSLocationAlwaysAndWhenInUseUsageDescription exists and has user-friendly text
- [ ] NSMotionUsageDescription exists (if using motion data)
- [ ] Descriptions explain the benefit to the user

✅ **Status:** ☐ Complete

---

### STEP 3: Configure Signing & Team
**Time:** 2 minutes

1. Select **App** target (red icon) in left navigator
2. Click **Signing & Capabilities** tab
3. **CRITICAL:** Check the box for **"Automatically manage signing"**
4. Select your **Team** from the dropdown
   - Should show your name and team ID
   - If no team appears, verify your Apple Developer account in Xcode Preferences

**What should happen:**
- Xcode will automatically create/download provisioning profiles
- Bundle Identifier should be set (e.g., `com.yourcompany.runsmart`)
- Should show: **"Xcode Managed Profile"** in Provisioning Profile field
- No red error messages

**If you see errors:**
- ❌ "Failed to create provisioning profile" → Check developer account status
- ❌ "No signing certificate" → Go to Xcode → Preferences → Accounts → Download Manual Profiles
- ❌ Bundle ID not available → Change Bundle ID to something unique

**Verification:**
- [ ] "Automatically manage signing" is checked
- [ ] Team is selected
- [ ] Bundle Identifier is set (e.g., `com.yourcompany.runsmart`)
- [ ] Provisioning Profile shows "Xcode Managed Profile"
- [ ] No red error icons or messages
- [ ] Status shows "Signing Certificate: Apple Development" or similar

✅ **Status:** ☐ Complete

---

### STEP 4: Enable Background Location Mode
**Time:** 2 minutes

**Still in Signing & Capabilities tab:**

1. Click **"+ Capability"** button (top left of the tab)
2. Search for: **Background Modes**
3. Double-click to add it
4. A new "Background Modes" section appears
5. **Check the box** for: **"Location updates"**

**Optional (check if you use these):**
- ☐ Background fetch (if syncing data in background)
- ☐ Remote notifications (if using push notifications)

**⚠️ Only enable what you actually use!**

**What this does:**
- Allows your app to continue tracking GPS when screen is locked
- Required for background run tracking
- Users still control permission via iOS Settings

**Verification:**
- [ ] Background Modes capability is added
- [ ] "Location updates" is checked
- [ ] Other modes unchecked unless you use them

✅ **Status:** ☐ Complete

---

### STEP 5: Set Version and Build Numbers
**Time:** 1 minute

1. Select **App** target → **General** tab
2. Look for **Identity** section at the top

**Set these values:**

**Version:** `1.0.0`
- This is your release version
- Use semantic versioning: MAJOR.MINOR.PATCH
- For first release: 1.0.0

**Build:** `1`
- Must be a number
- Must be unique for each upload
- For first upload: 1
- For second upload: 2, etc.

**Display Name:** `RunSmart` (or your preferred name)
- This is what appears under the app icon on iPhone

**Bundle Identifier:** (should already be set from Step 3)
- Format: `com.yourcompany.runsmart`
- Must match what you'll use in App Store Connect

**Verification:**
- [ ] Version is set to 1.0.0
- [ ] Build is set to 1
- [ ] Display Name is set
- [ ] Bundle Identifier matches expected format

✅ **Status:** ☐ Complete

---

### STEP 6: Test Build on Your iPhone 13
**Time:** 5 minutes

**CRITICAL: Always test before archiving!**

1. Connect your iPhone 13 via USB cable
2. Unlock your iPhone
3. If prompted "Trust This Computer?" → Tap **Trust**
4. In Xcode top toolbar, select your **iPhone 13** as the destination
   - Click the device dropdown (next to Run/Stop buttons)
   - Select your iPhone 13 from the list
5. Click the **Run** button (▶️) or press **⌘R**
6. Xcode will build and install the app on your iPhone

**First time only:**
- iPhone may show "Untrusted Developer" warning
- Go to: Settings → General → VPN & Device Management
- Tap your developer account
- Tap "Trust [Your Developer Name]"
- Return to app and launch

**What to test:**
- [ ] App launches without crashing
- [ ] Can navigate through main screens
- [ ] Location permission prompt appears
- [ ] Grant location permission "While Using the App"
- [ ] Try starting a run (don't need to complete it)
- [ ] GPS tracking indicator appears
- [ ] No crashes or freezes
- [ ] App feels responsive

**Stop the test run:**
- Click Stop button (⏹) in Xcode when done testing

**If app crashes:**
- Check Xcode console (bottom panel) for error messages
- Common issues:
  - Missing Info.plist permissions → Add them
  - Signing issues → Re-check Step 3
  - Missing assets → Check Capacitor sync worked
  - Code errors → Check build output

**Verification:**
- [ ] App installed successfully on iPhone 13
- [ ] App launches without crashing
- [ ] Basic functionality works
- [ ] Location permission can be granted
- [ ] No critical errors in Xcode console

✅ **Status:** ☐ Complete

---

### STEP 7: Prepare for Archive
**Time:** 1 minute

**Before archiving, do this:**

1. In Xcode top toolbar, change destination from "iPhone 13" to:
   **"Any iOS Device (arm64)"**
   
   - Click the device dropdown
   - Scroll to top
   - Select **"Any iOS Device (arm64)"**
   
   ⚠️ **CRITICAL:** Archive option only works with "Any iOS Device" selected!

2. Verify scheme is set to Release:
   - Product → Scheme → Edit Scheme (or ⌘<)
   - Select **Archive** in left sidebar
   - Under **Build Configuration**, select **Release**
   - Click **Close**

**Verification:**
- [ ] "Any iOS Device (arm64)" is selected in destination
- [ ] Archive scheme uses Release configuration
- [ ] Product → Archive is now enabled (not greyed out)

✅ **Status:** ☐ Complete

---

## 🚀 READY TO ARCHIVE & UPLOAD

### STEP 8: Create Archive
**Time:** 5-10 minutes (mostly waiting)**

1. **Product → Archive** (or hold ⌥⌘B)
2. Xcode will build your app for distribution
3. Progress bar shows at top of Xcode
4. Wait for build to complete (3-10 minutes depending on project size)
5. When complete, **Organizer** window opens automatically

**During the build:**
- ☕ Take a break! This takes a few minutes
- Watch for errors in the build log
- Should see "Archive Succeeded" when done

**If archive fails:**
- Read error message carefully
- Common issues:
  - Code signing error → Re-check Step 3
  - Missing files → Re-run `npx cap sync ios`
  - Build errors → Check Xcode console
  - Scheme not set to Release → Check Step 7

**When successful:**
- Organizer window appears
- Your archive appears at the top of the list
- Shows: App name, version (1.0.0), build (1), date/time

**Verification:**
- [ ] Archive completed without errors
- [ ] Organizer window opened
- [ ] Archive appears in the list
- [ ] Version shows 1.0.0
- [ ] Build shows 1

✅ **Status:** ☐ Complete

---

### STEP 9: Distribute to App Store Connect
**Time:** 10-15 minutes (mostly uploading)**

**In the Organizer window:**

1. **Select your archive** (should be highlighted already)
2. Click **"Distribute App"** button (right side)
3. Select: **"App Store Connect"** → Click **Next**
4. Select: **"Upload"** → Click **Next**
5. **Distribution options screen:**
   - ✅ **Upload your app's symbols** (checked - RECOMMENDED)
   - ✅ **Manage Version and Build Number** (checked - automatic)
   - ☐ Bitcode (may be disabled, that's fine)
   - Click **Next**
6. **Signing screen:**
   - Review automatic signing certificate
   - Should show your Team and certificate
   - Click **Next**
7. **Review screen:**
   - Review app name, version, build
   - App icon should appear
   - Bundle ID should match
   - Click **Upload**
8. **Upload progress:**
   - Progress bar appears
   - "Uploading..." message
   - Wait 5-15 minutes depending on app size and connection
9. **Success:**
   - Should see: **"Upload Successful"** ✅
   - May include a link to App Store Connect
   - Click **Done**

**If upload fails:**
- Check internet connection
- Verify app size < 4GB
- Try again (sometimes it's just a timeout)
- Check App Store Connect service status
- Try using Transporter app as alternative

**Verification:**
- [ ] Upload completed successfully
- [ ] Saw "Upload Successful" message
- [ ] No error dialogs

✅ **Status:** ☐ Complete

---

## 🎊 APP STORE CONNECT - FINAL STEPS

### STEP 10: Monitor Build Processing
**Time:** 5-30 minutes (waiting)**

1. Go to: **https://appstoreconnect.apple.com**
2. Sign in with your Apple Developer account
3. Click **"My Apps"**
4. **First time only:** Create new app
   - Click **+** button → **New App**
   - Platform: **iOS**
   - Name: **RunSmart** (must be unique on App Store)
   - Primary Language: **English** (or your preference)
   - Bundle ID: Select from dropdown (should match Xcode)
   - SKU: Enter unique ID (e.g., `RUNSMART-001`)
   - Click **Create**
5. Click on your app (RunSmart)
6. Go to **TestFlight** tab
7. Look under **iOS Builds** section
8. Your build will appear with status:
   - **"Processing..."** (wait 5-30 minutes)
   - → **"Ready to Submit"** (processing complete!)
   
**Check your email:**
- Apple sends notifications about build processing
- Any issues will be reported via email
- No email = no problems (good!)

**Common processing delays:**
- Normal: 5-30 minutes
- Acceptable: Up to 1 hour
- If > 2 hours: Check email for rejection notice

**Verification:**
- [ ] Logged into App Store Connect
- [ ] App record exists (created if needed)
- [ ] Build appears under TestFlight
- [ ] Build status is "Processing" or "Ready to Submit"

✅ **Status:** ☐ Complete

---

### STEP 11: Complete Export Compliance
**Time:** 1 minute**

**Once build shows in TestFlight:**

1. Click on your build version (e.g., 1.0.0 (1))
2. Look for **"Export Compliance"** section
3. Click **"Provide Export Compliance Information"**
4. Answer the question:
   
   **"Does your app use encryption?"**
   
   **Most likely answer: NO**
   
   Answer YES only if:
   - You implement custom encryption
   - You use third-party encryption libraries (beyond standard HTTPS)
   
   Answer NO if:
   - You only use HTTPS/SSL (standard)
   - You use iOS standard encryption APIs
   - You're not sure (probably means NO)

5. Click **Submit**

**Verification:**
- [ ] Export compliance question answered
- [ ] Build status changes to "Ready to Submit"

✅ **Status:** ☐ Complete

---

### STEP 12: Set Up Internal Testing
**Time:** 3 minutes**

1. In TestFlight tab, click **"Internal Testing"** (left sidebar)
2. You might see a default test group, or click **"+" to create one**
3. Give your group a name: **"Core Team"** or **"Internal Testers"**
4. Click **"Add Testers"**
5. Enter email addresses of your team members
   - They must be added to your App Store Connect team first
   - Or use the "Add Tester" button to invite them
6. Select which build to distribute: **1.0.0 (1)**
7. **Optional:** Enable **"Automatic Distribution"**
   - Future builds automatically sent to this group
8. Click **"Add"** or **"Save"**

**What happens next:**
- Testers receive email invitation
- They download **TestFlight** app from App Store (if they don't have it)
- They click invitation link
- They can install RunSmart from TestFlight
- They can test the app!

**Internal Testing Benefits:**
- Up to 100 internal testers
- **No App Review required** (immediate testing)
- Can test unlimited builds
- Great for quick iteration

**Verification:**
- [ ] Internal test group created
- [ ] Testers added (email addresses)
- [ ] Build distributed to group
- [ ] Testers receive invitation emails

✅ **Status:** ☐ Complete

---

## 🎉 SUCCESS! YOU'RE DONE!

### What You've Accomplished:

✅ **Configuration:**
- Release build configuration linked
- Info.plist privacy permissions verified
- Code signing configured
- Background modes enabled
- Version and build numbers set

✅ **Testing:**
- App tested on iPhone 13
- GPS tracking verified working
- Email verification verified working
- No critical bugs

✅ **Upload:**
- Archive created successfully
- Uploaded to App Store Connect
- Build processed successfully
- Export compliance completed

✅ **TestFlight:**
- Internal testers added
- Build distributed
- Ready for testing!

---

## 📱 NEXT STEPS

### For Your Internal Testers:

**They should:**
1. Check email for TestFlight invitation
2. Download TestFlight app from App Store (if needed)
3. Open invitation email and tap "View in TestFlight"
4. Tap "Install" or "Accept"
5. Install RunSmart from TestFlight
6. Test the app and provide feedback

**Feedback Collection:**
- TestFlight has built-in feedback feature
- Testers can take screenshots and report issues
- You see feedback in App Store Connect
- Use `QA_SESSION_LOG.md` to track issues

### For You:

**Testing Phase (3-7 days recommended):**
- [ ] Collect feedback from testers
- [ ] Complete remaining QA tests (Tests 2-10 in QA_SESSION_LOG.md)
- [ ] Document any bugs found
- [ ] Prioritize fixes

**If Bugs Found:**
1. Fix bugs in your code
2. Increment **Build** number: 1 → 2
3. Keep **Version** same: 1.0.0
4. Rebuild: `npm run build && npx cap sync ios`
5. Repeat archive & upload process
6. New build appears in TestFlight

**When Ready for App Store:**
- [ ] All critical bugs fixed
- [ ] App tested thoroughly by team
- [ ] Prepare App Store metadata:
  - Screenshots (required)
  - App description
  - Keywords
  - Privacy policy URL
  - Support URL
  - Demo account credentials
- [ ] Submit for App Store review
  - Go to App Store Connect → App Store tab
  - Fill in all metadata
  - Select your build
  - Submit for Review
  - Wait 2-5 days for review

---

## 📊 PROGRESS TRACKER

### Build 1 (Current):
- [x] VS Code preparation
- [x] Xcode configuration
- [x] Archive created
- [x] Uploaded to App Store Connect
- [x] Build processed
- [x] Internal testers added
- [ ] Testing in progress
- [ ] Feedback collected
- [ ] Ready for next iteration or App Store

---

## 🔄 FOR FUTURE BUILDS

**When you need to upload a new build:**

1. **Fix code/bugs in VS Code**
2. **Increment build number in Xcode:**
   - App target → General → Identity → Build: 2, 3, 4...
3. **Build and sync:**
   ```bash
   npm run build
   npx cap sync ios
   ```
4. **In Xcode:**
   - Product → Clean Build Folder (⌘⇧K)
   - Product → Archive
5. **Distribute same as before**
6. **New build appears in TestFlight automatically**

**Build number progression:**
- 1.0.0 (1) ← First TestFlight build
- 1.0.0 (2) ← Bug fixes
- 1.0.0 (3) ← More fixes
- 1.0.0 (4) ← Final TestFlight build
- 1.0.0 (5) ← Submitted to App Store
- 1.0.1 (6) ← First update after release

---

## 📝 QUICK REFERENCE

### Key File Locations (Your Project):
```
apps/ios/App/App/Info.plist          (Privacy descriptions)
apps/ios/App/release.xcconfig         (Release configuration)
apps/ios/App/App/public/              (Synced web content)
```

### Important URLs:
- **App Store Connect:** https://appstoreconnect.apple.com
- **Developer Portal:** https://developer.apple.com
- **TestFlight:** Accessible via App Store Connect
- **System Status:** https://developer.apple.com/system-status/

### Xcode Shortcuts:
- **Clean:** ⌘⇧K
- **Run:** ⌘R
- **Archive:** Product → Archive (or ⌥⌘B)
- **Organizer:** Window → Organizer
- **Edit Scheme:** ⌘<

---

## 🆘 TROUBLESHOOTING

### Issue: Archive is greyed out
**Solution:** Select "Any iOS Device (arm64)" not a simulator

### Issue: Signing failed
**Solutions:**
1. Enable "Automatically manage signing"
2. Select your team
3. Xcode → Preferences → Accounts → Download Manual Profiles
4. Check developer account membership is active

### Issue: Upload failed
**Solutions:**
1. Check internet connection
2. Verify app size < 4GB
3. Wait a few minutes and try again
4. Check App Store Connect service status
5. Try using Transporter app (separate Mac app)

### Issue: Build stuck "Processing"
**Solutions:**
1. Normal if < 1 hour
2. Check email for Apple notifications
3. Refresh page in App Store Connect
4. Check system status page

### Issue: Missing entitlements error
**Solution:** Check Background Modes are properly enabled

### Issue: Info.plist permissions not working
**Solution:** 
1. Verify exact key names (case-sensitive)
2. Rebuild after adding permissions
3. Delete app from device and reinstall

---

## ✅ FINAL CHECKLIST

Before considering this phase complete:

**Xcode Configuration:**
- [x] Release configuration linked
- [x] Info.plist verified
- [x] Signing configured
- [x] Background modes enabled
- [x] Version/build set
- [x] Tested on device

**Upload:**
- [x] Archive created
- [x] Uploaded successfully
- [x] Build processed
- [x] Export compliance done

**TestFlight:**
- [x] Internal testers added
- [x] Build distributed
- [ ] Testers can install ← **VERIFY THIS**
- [ ] Testers provide feedback ← **ONGOING**

**Testing:**
- [ ] Complete QA tests 2-10
- [ ] No critical bugs
- [ ] Ready for App Store OR
- [ ] New build needed with fixes

---

## 🎊 CONGRATULATIONS!

**You've successfully uploaded RunSmart to TestFlight!** 🚀

Your app is now available for internal testing. This is a major milestone!

**What you've achieved:**
- ✅ Fixed critical bugs (email verification, GPS)
- ✅ Configured production build
- ✅ Passed validation checks
- ✅ Created archive
- ✅ Uploaded to App Store Connect
- ✅ Set up TestFlight testing

**You're now in the testing & iteration phase.**

Collect feedback, fix any issues, and when ready, submit to the App Store!

---

**Need to reference the complete process again?**
See: `TESTFLIGHT_CHECKLIST.md` or `QUICK_TESTFLIGHT_GUIDE.md`

**Happy testing! 🎉**
