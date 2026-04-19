
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

## SESSION SUMMARY
**Total Tests Completed:** 0 / 10
**Pass:** 0
**Fail:** 0
**Blockers Found:** 0
**High Severity:** 0
**Medium/Low:** 0

**Overall Status:** IN PROGRESS
**Recommendation:** TBD
