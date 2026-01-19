# Admin Dashboard Testing Guide

This guide outlines how to test the admin dashboard functionality.

## Prerequisites

1. Development server running: `npm run dev`
2. Supabase instance configured with migrations applied
3. At least one admin email configured in `.env.local`

## Test Cases

### 1. Admin Access - Positive Test

**Objective**: Verify admin users can access the dashboard

**Steps**:
1. Sign up with an email listed in `ADMIN_EMAILS` environment variable
2. Navigate to `http://localhost:3000/admin/dashboard`
3. Verify the dashboard loads successfully

**Expected Result**:
- Dashboard displays with metrics
- Navigation bar shows admin email
- "Back to App" button is visible
- No redirect occurs

### 2. Admin Access - Negative Test

**Objective**: Verify non-admin users cannot access the dashboard

**Steps**:
1. Sign up with an email NOT listed in `ADMIN_EMAILS`
2. Attempt to navigate to `http://localhost:3000/admin/dashboard`

**Expected Result**:
- User is immediately redirected to `/` (home page)
- Dashboard is never displayed
- No error message is shown (silent redirect)

### 3. Unauthenticated Access

**Objective**: Verify unauthenticated users cannot access the dashboard

**Steps**:
1. Sign out or open incognito window
2. Navigate to `http://localhost:3000/admin/dashboard`

**Expected Result**:
- User is redirected to `/` (home page)
- No dashboard content is displayed

### 4. Metrics Display

**Objective**: Verify metrics are calculated and displayed correctly

**Setup**:
1. Create 2-3 test users
2. Record 5-10 runs across these users
3. Ensure at least one user has completed onboarding

**Steps**:
1. Access admin dashboard as admin user
2. Observe the metrics cards

**Expected Result**:
- **Total Users**: Should match number of profiles in database
- **Active Users (7d)**: Should show users who recorded runs in last 7 days
- **Total Runs**: Should match total runs count
- **Runs This Week**: Should show runs since Sunday of current week
- **Average Runs Per User**: Should be calculated correctly (total runs / total users)
- **Onboarding Completion**: Should show percentage with completed onboarding

### 5. User List Table

**Objective**: Verify user list displays correct information

**Setup**:
1. Ensure database has multiple users with varying data:
   - Some with completed onboarding, some without
   - Some with runs, some without
   - Different creation dates

**Steps**:
1. Access admin dashboard
2. Scroll to "Recent Users" section

**Expected Result**:
- Table displays up to 100 most recent users
- Columns show: User (name + email), Onboarding status, Runs count, Goals count, Last activity, Joined date
- Onboarding status shows green "Complete" badge or gray "Pending" badge
- Last activity shows date of most recent run or "Never"
- Data is sorted by creation date (newest first)

### 6. External Analytics Links

**Objective**: Verify analytics links work correctly

**Steps**:
1. Access admin dashboard
2. Click on "PostHog Analytics" link
3. Click on "Google Analytics" link

**Expected Result**:
- Both links open in new tabs (`target="_blank"`)
- PostHog link goes to `https://us.i.posthog.com`
- Google Analytics link goes to Google Analytics dashboard

### 7. Navigation

**Objective**: Verify navigation works correctly

**Steps**:
1. Access admin dashboard
2. Click "Back to App" button

**Expected Result**:
- User is navigated back to `/` (main app)
- Session remains authenticated

### 8. Loading States

**Objective**: Verify loading states display correctly

**Setup**:
1. Throttle network to simulate slow connection (Chrome DevTools)

**Steps**:
1. Access admin dashboard with throttled network

**Expected Result**:
- Metrics cards show "..." while loading
- User list shows "Loading users..." message
- Once data loads, actual values replace loading states

### 9. Error Handling

**Objective**: Verify graceful handling of data fetch errors

**Setup**:
1. Temporarily disconnect from Supabase or disable network

**Steps**:
1. Access admin dashboard with no connection

**Expected Result**:
- Page doesn't crash
- Loading states eventually resolve
- Console shows error messages (check browser console)
- Metrics show 0 or empty states

### 10. Responsive Design

**Objective**: Verify dashboard works on different screen sizes

**Steps**:
1. Access admin dashboard on desktop (1920x1080)
2. Resize browser to tablet size (768px)
3. Resize to mobile size (375px)

**Expected Result**:
- Metrics grid adjusts from 4 columns → 2 columns → 1 column
- User table remains scrollable horizontally on small screens
- Navigation remains functional at all sizes
- No content overflow or visual breaks

## Performance Tests

### Load Test
- **Test**: Access dashboard with 100+ users in database
- **Expected**: Page loads in < 5 seconds
- **Metrics queries complete in < 3 seconds**

### Concurrent Access
- **Test**: Multiple admins access dashboard simultaneously
- **Expected**: No conflicts or errors
- **Each session maintains independent state**

## Security Tests

### 1. Email Spoofing Protection
**Test**: Attempt to access admin routes by manually setting cookies
**Expected**: Middleware validates against Supabase auth, not just cookies

### 2. Direct URL Access
**Test**: Try accessing `/admin/dashboard` directly without login
**Expected**: Redirect to home page

### 3. Environment Variable Protection
**Test**: Ensure `ADMIN_EMAILS` is not exposed to client
**Expected**: Variable only accessible server-side

## Manual Testing Checklist

Before deploying to production, verify:

- [ ] Admin user can access dashboard
- [ ] Non-admin user is blocked from dashboard
- [ ] Unauthenticated user is blocked from dashboard
- [ ] All metrics display correct values
- [ ] User list loads and displays correctly
- [ ] Onboarding badges show correctly (green/gray)
- [ ] External links open in new tabs
- [ ] "Back to App" button works
- [ ] Dashboard is responsive on mobile
- [ ] No console errors during normal operation
- [ ] Loading states display properly
- [ ] Error states are handled gracefully

## Automated Testing

### Unit Tests (Future)
Create tests in `app/admin/dashboard/__tests__/`:
- Metrics calculation logic
- User data transformation
- Admin email validation

### E2E Tests (Future)
Use Playwright to test:
- Full admin access flow
- Non-admin rejection flow
- Metrics display accuracy
- Navigation functionality

## Troubleshooting

### Issue: "Cannot access admin dashboard"
**Solution**: Verify your email is in `ADMIN_EMAILS` environment variable

### Issue: "Metrics showing 0"
**Solution**: Check Supabase RLS policies and ensure data exists

### Issue: "User emails show as 'user@example.com'"
**Solution**: Service role key may not be configured or auth.users access is restricted

### Issue: "Page redirects immediately"
**Solution**: Check authentication status and admin email whitelist

## Notes

- Admin dashboard uses **client-side data fetching** for metrics
- User list queries execute **in parallel** for performance
- Email access requires **service role key** (may not work from browser client)
- All data queries respect **Row-Level Security** policies
