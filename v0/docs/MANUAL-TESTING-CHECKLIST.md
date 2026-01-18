# Manual Testing Checklist - Authentication & Sync System

This comprehensive checklist covers all aspects of the authentication and sync system including the admin dashboard.

## Prerequisites

- [ ] Development server running (`npm run dev`)
- [ ] Supabase instance configured and accessible
- [ ] All migrations applied to Supabase
- [ ] Admin email configured in `.env.local`
- [ ] PostHog and Google Analytics configured

---

## 1. Authentication Flow

### 1.1 User Signup

- [ ] **Valid Signup**
  - [ ] Navigate to signup page
  - [ ] Enter valid email (e.g., `test@example.com`)
  - [ ] Enter strong password (min 8 characters)
  - [ ] Confirm password matches
  - [ ] Submit form
  - [ ] Verify email verification prompt/message appears
  - [ ] Check Supabase Auth dashboard for new user
  - [ ] Verify profile created in `profiles` table

- [ ] **Invalid Signup - Weak Password**
  - [ ] Enter password with < 6 characters
  - [ ] Verify error message displayed
  - [ ] Form should not submit

- [ ] **Invalid Signup - Mismatched Passwords**
  - [ ] Enter different passwords in password and confirm fields
  - [ ] Verify error message displayed
  - [ ] Form should not submit

- [ ] **Invalid Signup - Duplicate Email**
  - [ ] Try to sign up with existing email
  - [ ] Verify appropriate error message
  - [ ] User should not be created

- [ ] **Invalid Signup - Invalid Email Format**
  - [ ] Enter invalid email (e.g., `not-an-email`)
  - [ ] Verify error message displayed
  - [ ] Form should not submit

### 1.2 User Login

- [ ] **Valid Login**
  - [ ] Enter registered email
  - [ ] Enter correct password
  - [ ] Submit form
  - [ ] Verify redirected to main app
  - [ ] Session should persist on page refresh

- [ ] **Invalid Login - Wrong Password**
  - [ ] Enter registered email
  - [ ] Enter incorrect password
  - [ ] Verify error message displayed
  - [ ] User should not be logged in

- [ ] **Invalid Login - Non-existent Email**
  - [ ] Enter email that doesn't exist
  - [ ] Enter any password
  - [ ] Verify error message displayed

### 1.3 Session Management

- [ ] **Session Persistence**
  - [ ] Log in
  - [ ] Refresh page
  - [ ] Verify still logged in
  - [ ] Check profile data still available

- [ ] **Session Across Tabs**
  - [ ] Log in on Tab 1
  - [ ] Open new Tab 2
  - [ ] Navigate to app in Tab 2
  - [ ] Verify logged in on both tabs

- [ ] **Logout**
  - [ ] Click logout button
  - [ ] Verify redirected to home/login
  - [ ] Verify session cleared
  - [ ] Try to access protected route
  - [ ] Should redirect to login

### 1.4 Profile Creation

- [ ] **Profile Data**
  - [ ] After signup, check `profiles` table in Supabase
  - [ ] Verify `auth_user_id` matches user ID from Auth
  - [ ] Verify `created_at` timestamp is correct
  - [ ] Verify `onboarding_complete` is false initially
  - [ ] Verify `device_id` is null (for new users)

---

## 2. Device Migration & Welcome Modal

### 2.1 Existing Device User

- [ ] **Scenario: User with existing local data signs up**
  - [ ] Have local data in IndexedDB (runs, goals, etc.)
  - [ ] Sign up with new account
  - [ ] Verify welcome modal appears
  - [ ] Modal should mention data migration
  - [ ] Click "Continue" or "Got it"
  - [ ] Modal should close

- [ ] **Verify Device Migration**
  - [ ] Check `user_memory_snapshots` table
  - [ ] Old `device_id` should be updated to new `profile_id`
  - [ ] Verify all local data is preserved
  - [ ] Initial sync should upload all data

### 2.2 New User (No Local Data)

- [ ] **Scenario: First-time user with no local data**
  - [ ] Clear IndexedDB completely
  - [ ] Sign up with new account
  - [ ] Welcome modal should NOT appear
  - [ ] Should proceed directly to onboarding or main app

---

## 3. Data Sync

### 3.1 Initial Sync

- [ ] **First Sync After Signup**
  - [ ] Create local data before signing up (runs, goals, shoes)
  - [ ] Sign up
  - [ ] Wait for initial sync (auto-triggered)
  - [ ] Check Supabase tables (`runs`, `goals`, `shoes`)
  - [ ] Verify all local data is uploaded
  - [ ] Verify `profile_id` is set correctly
  - [ ] Verify `local_id` matches local IndexedDB IDs

### 3.2 Incremental Sync

- [ ] **Background Sync (Every 5 Minutes)**
  - [ ] Log in
  - [ ] Add new run locally
  - [ ] Wait 5+ minutes
  - [ ] Check Supabase - new run should appear
  - [ ] Verify only new/updated records synced

- [ ] **Manual Sync Trigger**
  - [ ] Record a run
  - [ ] Complete the run
  - [ ] Sync should trigger immediately
  - [ ] Check sync status indicator
  - [ ] Verify run appears in Supabase within seconds

### 3.3 Sync Status Indicator

- [ ] **Idle State**
  - [ ] When not syncing, indicator should show "Synced" or checkmark
  - [ ] Should be green/positive color

- [ ] **Syncing State**
  - [ ] Trigger sync (record run or wait for interval)
  - [ ] Indicator should show "Syncing..." with spinner
  - [ ] Should be blue/neutral color

- [ ] **Error State**
  - [ ] Disconnect from internet
  - [ ] Trigger sync
  - [ ] Indicator should show error state
  - [ ] Should be red/warning color
  - [ ] Error message should be helpful

### 3.4 Offline Support

- [ ] **Record Data Offline**
  - [ ] Disconnect from internet
  - [ ] Record a run
  - [ ] Data should save locally
  - [ ] Reconnect to internet
  - [ ] Wait for auto-sync
  - [ ] Verify data syncs to Supabase

### 3.5 Conflict Resolution

- [ ] **Last-Write-Wins**
  - [ ] Modify same record on two devices
  - [ ] Sync both devices
  - [ ] Most recent update should win
  - [ ] Verify `updated_at` timestamps

### 3.6 Batch Syncing

- [ ] **Large Dataset (100+ Records)**
  - [ ] Create 150+ runs locally
  - [ ] Trigger sync
  - [ ] Verify sync completes without errors
  - [ ] Check Supabase - all records should be present
  - [ ] Verify batching occurred (check network requests)

---

## 4. Admin Dashboard

### 4.1 Access Control

- [ ] **Admin User Access**
  - [ ] Log in with email from `ADMIN_EMAILS`
  - [ ] Navigate to `/admin/dashboard`
  - [ ] Dashboard should load successfully
  - [ ] All metrics should be visible

- [ ] **Non-Admin User Block**
  - [ ] Log in with regular user email
  - [ ] Try to navigate to `/admin/dashboard`
  - [ ] Should redirect to home page immediately
  - [ ] Dashboard should never render

- [ ] **Unauthenticated Access**
  - [ ] Log out
  - [ ] Try to navigate to `/admin/dashboard`
  - [ ] Should redirect to home page
  - [ ] No admin content should be visible

### 4.2 Metrics Display

- [ ] **Total Users**
  - [ ] Check metric shows correct count
  - [ ] Compare with Supabase `profiles` table count
  - [ ] Should match exactly

- [ ] **Active Users (7 Days)**
  - [ ] Check metric value
  - [ ] Manually count users with runs in last 7 days
  - [ ] Should match count

- [ ] **Total Runs**
  - [ ] Check metric value
  - [ ] Compare with Supabase `runs` table count
  - [ ] Should match exactly

- [ ] **Runs This Week**
  - [ ] Check metric value
  - [ ] Count runs since Sunday of current week
  - [ ] Should match count

- [ ] **Average Runs Per User**
  - [ ] Check calculated value
  - [ ] Verify: Total Runs ÷ Total Users
  - [ ] Should be correct to 1 decimal place

- [ ] **Onboarding Completion**
  - [ ] Check percentage value
  - [ ] Count users with `onboarding_complete = true`
  - [ ] Verify: (Completed / Total Users) × 100
  - [ ] Should be correct percentage

### 4.3 User List Table

- [ ] **User Data Display**
  - [ ] Table shows up to 100 users
  - [ ] Each row has: Name, Email, Onboarding Status, Runs, Goals, Last Activity, Joined Date
  - [ ] Data matches Supabase records

- [ ] **Onboarding Status Badges**
  - [ ] Users with completed onboarding show green "Complete" badge with checkmark
  - [ ] Users without completed onboarding show gray "Pending" badge with X icon
  - [ ] Badge colors are correct

- [ ] **Activity Dates**
  - [ ] "Last Activity" shows date of most recent run
  - [ ] Users with no runs show "Never"
  - [ ] "Joined" date matches `created_at` in profiles

- [ ] **Run and Goal Counts**
  - [ ] Counts match actual data in database
  - [ ] Spot-check 3-5 users manually

### 4.4 External Analytics Links

- [ ] **PostHog Link**
  - [ ] Link is visible
  - [ ] Icon and description are correct
  - [ ] Click link
  - [ ] Opens PostHog in new tab
  - [ ] URL is correct (`https://us.i.posthog.com`)

- [ ] **Google Analytics Link**
  - [ ] Link is visible
  - [ ] Icon and description are correct
  - [ ] Click link
  - [ ] Opens Google Analytics in new tab
  - [ ] URL points to correct property

### 4.5 Navigation

- [ ] **Back to App Button**
  - [ ] Button is visible in navigation
  - [ ] Click button
  - [ ] Navigates to home page
  - [ ] User remains logged in

- [ ] **Admin Email Display**
  - [ ] Admin's email is shown in navigation
  - [ ] Email matches logged-in user

### 4.6 Loading States

- [ ] **Initial Load**
  - [ ] Metrics show "..." while loading
  - [ ] User list shows "Loading users..."
  - [ ] Loading completes within 5 seconds
  - [ ] Data appears correctly

- [ ] **Slow Connection**
  - [ ] Throttle network to Slow 3G
  - [ ] Navigate to admin dashboard
  - [ ] Loading states should display
  - [ ] Eventually data loads
  - [ ] No crashes or infinite loading

### 4.7 Error Handling

- [ ] **Network Error**
  - [ ] Disconnect from internet
  - [ ] Navigate to admin dashboard
  - [ ] Should show error state gracefully
  - [ ] No crashes
  - [ ] Check browser console for error logs

- [ ] **Database Error**
  - [ ] (If possible) cause a database error
  - [ ] Dashboard should handle gracefully
  - [ ] Error message in console
  - [ ] User sees empty state or error message

---

## 5. Analytics Tracking

### 5.1 PostHog Events

- [ ] **Auth Events**
  - [ ] Sign up → Check PostHog for "signup" event
  - [ ] Log in → Check for "login" event
  - [ ] Log out → Check for "logout" event
  - [ ] Device migration → Check for "migration" event

- [ ] **Sync Events**
  - [ ] Sync starts → Check for "sync_started" event
  - [ ] Sync completes → Check for "sync_completed" event with record count
  - [ ] Sync fails → Check for "sync_failed" event

### 5.2 Google Analytics

- [ ] **Page Views**
  - [ ] Navigate through app
  - [ ] Check GA Real-Time report
  - [ ] Verify page views are tracked

- [ ] **User Properties**
  - [ ] Check GA for user properties (if configured)
  - [ ] Verify authenticated status

---

## 6. Edge Cases & Error Scenarios

### 6.1 Network Interruptions

- [ ] **Sync During Network Loss**
  - [ ] Start sync
  - [ ] Disconnect internet mid-sync
  - [ ] Verify graceful error handling
  - [ ] Reconnect internet
  - [ ] Sync should retry automatically

- [ ] **Login During Network Loss**
  - [ ] Try to log in offline
  - [ ] Should show appropriate error
  - [ ] No crashes

### 6.2 Browser Compatibility

- [ ] **Chrome**
  - [ ] Full signup/login/sync flow works

- [ ] **Firefox**
  - [ ] Full signup/login/sync flow works

- [ ] **Safari**
  - [ ] Full signup/login/sync flow works

- [ ] **Edge**
  - [ ] Full signup/login/sync flow works

### 6.3 Mobile Responsiveness

- [ ] **Mobile Chrome (Android)**
  - [ ] Auth forms are usable
  - [ ] Sync status indicator visible
  - [ ] Admin dashboard (if admin) is responsive

- [ ] **Mobile Safari (iOS)**
  - [ ] Auth forms work correctly
  - [ ] Sync functions properly
  - [ ] IndexedDB storage works

### 6.4 Data Integrity

- [ ] **Large GPS Paths**
  - [ ] Record run with 1000+ GPS points
  - [ ] Verify syncs successfully
  - [ ] Check data integrity in Supabase

- [ ] **Special Characters**
  - [ ] Add run with special characters in notes
  - [ ] Sync to Supabase
  - [ ] Verify data is not corrupted

- [ ] **Null Values**
  - [ ] Create records with optional null fields
  - [ ] Sync to Supabase
  - [ ] Verify null values handled correctly

---

## 7. Performance Tests

### 7.1 Sync Performance

- [ ] **500 Runs Sync**
  - [ ] Create 500 runs locally
  - [ ] Trigger sync
  - [ ] Should complete within 60 seconds
  - [ ] No timeouts or errors

- [ ] **Concurrent Syncs**
  - [ ] Two devices, same account
  - [ ] Trigger sync on both
  - [ ] Both should complete successfully
  - [ ] No conflicts or data loss

### 7.2 Dashboard Performance

- [ ] **Large User Base (100+ Users)**
  - [ ] Dashboard loads in < 5 seconds
  - [ ] Metrics calculate correctly
  - [ ] User list renders without lag

- [ ] **Dashboard Refresh**
  - [ ] Refresh page multiple times
  - [ ] No memory leaks
  - [ ] Consistent performance

---

## 8. Security Tests

### 8.1 Authentication Security

- [ ] **Password Requirements**
  - [ ] System enforces minimum password length
  - [ ] Weak passwords are rejected

- [ ] **Session Security**
  - [ ] Sessions expire after appropriate time
  - [ ] Tokens are not exposed in console/network logs

### 8.2 Row-Level Security (RLS)

- [ ] **User A Cannot See User B's Data**
  - [ ] Log in as User A
  - [ ] Try to query User B's data via console
  - [ ] Should be blocked by RLS

- [ ] **Anonymous Users**
  - [ ] Log out
  - [ ] Try to access Supabase data
  - [ ] Should be blocked

### 8.3 Admin Dashboard Security

- [ ] **Middleware Protection**
  - [ ] Verify middleware blocks unauthorized access
  - [ ] Check server logs for access attempts

- [ ] **Layout Protection**
  - [ ] Even if middleware bypassed, layout should redirect
  - [ ] Double layer of security

---

## 9. Regression Tests

After making ANY changes to auth or sync code, re-run these critical tests:

- [ ] New user signup works
- [ ] Existing user login works
- [ ] Initial sync uploads all local data
- [ ] Incremental sync only uploads new data
- [ ] Admin dashboard loads for admin users
- [ ] Non-admin users cannot access admin dashboard
- [ ] Logout clears session
- [ ] Offline data syncs when reconnected

---

## 10. Final Verification

Before deploying to production:

- [ ] All tests above passed
- [ ] No console errors during normal operation
- [ ] Supabase RLS policies verified
- [ ] Environment variables set correctly
- [ ] Admin emails configured
- [ ] Analytics tracking working
- [ ] PostHog events firing
- [ ] Google Analytics receiving data
- [ ] Build completes without errors (`npm run build`)
- [ ] Production environment tested (staging)

---

## Notes & Issues Log

Use this section to log any issues found during testing:

| Test | Issue Description | Severity | Status | Notes |
|------|-------------------|----------|--------|-------|
|      |                   |          |        |       |

**Severity Levels:**
- Critical: Prevents core functionality
- High: Major feature broken
- Medium: Minor bug, workaround exists
- Low: Cosmetic or rare edge case

---

## Test Summary

**Date**: __________
**Tester**: __________
**Environment**: Dev / Staging / Production
**Total Tests**: __________
**Passed**: __________
**Failed**: __________
**Blocked**: __________

**Overall Status**: ☐ Pass ☐ Fail ☐ Needs Retest

**Comments**:
