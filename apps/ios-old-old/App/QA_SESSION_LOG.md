
# RunSmart QA Session Log
**Date:** March 26, 2026
**Tester:** QA Session
**Device:** iPhone 13
**iOS Version:** iOS 26.3
**Build Number:** [To be determined from TestFlight]

---

## 30-MINUTE SMOKE TEST

### ✅ TEST 1: Install & Launch (2 min)
**Status:** COMPLETED (App already running)
**Started:** Pre-installed state

#### Actions Checklist:
- [x] App already installed
- [x] App launched successfully
- [x] Reached login/signup screen

#### Results:
**Launch Time:** N/A (already running)
**Xcode Console:** Not monitored yet (setup needed)

**Screenshots:**
- [ ] Login/signup screen (NEEDED)

**Issues Found:**
```
None - App launched and reached login screen successfully
```

---

### ⏸️ TEST 2: Authentication (3 min)
**Status:** PENDING
**Test will start after TEST 1 completion**

---

### ⏸️ TEST 3: First Run Recording (8 min)
**Status:** PENDING

---

### ⏸️ TEST 4: Background Test (3 min)
**Status:** PENDING

---

### ⏸️ TEST 5: Run History (2 min)
**Status:** PENDING

---

### ⏸️ TEST 6: AI Coach (3 min)
**Status:** PENDING

---

### ⏸️ TEST 7: Garmin Sync (2 min)
**Status:** PENDING

---

### ⏸️ TEST 8: Training Plan (2 min)
**Status:** PENDING

---

### ⏸️ TEST 9: Offline Test (2 min)
**Status:** PENDING

---

### ⏸️ TEST 10: App State Test (3 min)
**Status:** PENDING

---

## BUGS DISCOVERED

### Bug #1: Password Reset Email Fails to Send
**Status:** CONFIRMED - Needs Investigation
**Severity:** HIGH
**Title:** "Forgot Password" feature fails with "Failed to send reset email" error

**Description:**
User attempted to reset password using "Forgot Password" link on login screen. System returned error message: "Failed to send reset email"

**Steps to Reproduce:**
1. Launch RunSmart app
2. On login screen, tap "Forgot Password" link
3. Enter registered email address
4. Tap "Send Reset Email" (or equivalent button)
5. Observe error message

**Expected Result:**
- Success message: "Password reset email sent to [email]"
- User receives email with reset link within 1-2 minutes

**Actual Result:**
- Error message displayed: "Failed to send reset email"
- No email received

**Impact:**
- Users cannot reset forgotten passwords
- Locked out of account until manual intervention
- Critical for user recovery flow

**Device Info:**
- Device: iPhone 13
- iOS: 26.3
- Build: [TBD from TestFlight]

**Console Logs:**
[Not captured yet - Xcode Console not running]

**Screenshots Needed:**
- [ ] Error message on screen
- [ ] Email input field before submit

**Next Steps:**
1. Verify network connectivity
2. Test with different email addresses
3. Check Xcode console for API errors
4. Verify email service backend status

---

---

### Bug #2: App Stuck Loading - Profile Not Loading After Auth
**Status:** INVESTIGATING
**Severity:** CRITICAL - BLOCKING
**Title:** App stuck in loading state - user profile never loads after successful authentication

**Description:**
App successfully authenticates user but gets stuck in infinite loading state. Console logs show `auth.loading: true` and `profileId: null` indefinitely. User cannot proceed to main app.

**Steps to Reproduce:**
1. Launch RunSmart app
2. Sign in with existing account (or app auto-signs in)
3. Observe app stays on loading screen
4. Never reaches main screen

**Expected Result:**
- User profile loads after authentication
- App proceeds to main screen
- `auth.loading: false` and `profileId` populated

**Actual Result:**
- `auth.loading: true` permanently
- `profileId: null` never changes
- App stuck in "waiting_for_auth" phase
- User ID exists: `068053fd-204e-4053-b1af-c70cf74a0440`

**Console Evidence:**
```
⚡️  [Auth] Auth state changed: SIGNED_IN
⚡️  [info] - [app:init:diag] auth_state {
  "auth": {
    "loading": true,
    "hasUser": true,
    "profileId": null  ← STUCK HERE
  }
}
```

**Root Cause Analysis:**
Likely causes (in order):
1. Profile row doesn't exist in database for this user
2. RLS (Row Level Security) blocking profile query
3. Profile API query timing out
4. JavaScript exception preventing profile load

**Impact:**
- **BLOCKING** - App completely unusable
- Cannot access any features
- User cannot proceed past loading screen
- Affects all users who sign in

**Device Info:**
- Device: iPhone 13
- iOS: 26.3
- Build: TestFlight Build 1
- Timestamp: 2026-04-26T13:15:12.895Z
- User ID: 068053fd-204e-4053-b1af-c70cf74a0440

**Additional Console Warnings:**
```
⚡️  JS Eval error A JavaScript exception occurred
```
(Full exception details needed - requires Safari DevTools)

**Next Steps:**
1. ✅ Check if profile exists: `SELECT * FROM profiles WHERE id = '068053fd-204e-4053-b1af-c70cf74a0440'`
2. ⏳ Check RLS policies on profiles table
3. ⏳ Review Supabase logs for failed queries
4. ⏳ Connect Safari DevTools to see full JavaScript error
5. ⏳ Fix root cause based on findings

**Priority:** IMMEDIATE - Must fix before any testing can continue

---

## SESSION SUMMARY
**Total Tests Completed:** 0 / 10
**Pass:** 0
**Fail:** 0
**Blockers Found:** 2
**Critical:** 2 (Password Reset, Profile Loading)
**High Severity:** 0
**Medium/Low:** 0

**Overall Status:** BLOCKED - Cannot proceed with testing
**Recommendation:** HALT TESTING - Fix critical bugs before continuing
**Blocking Issues:**
1. Bug #1: Password reset email fails (HIGH)
2. Bug #2: App stuck loading - profile not loading (CRITICAL - BLOCKING ALL TESTING)

