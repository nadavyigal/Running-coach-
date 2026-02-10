# PostHog Production Setup & Verification

## ✅ Current Status

Your PostHog analytics integration is **fully operational** in production!

- **Production URL**: https://www.runsmart-ai.com
- **PostHog Dashboard**: https://us.posthog.com/project/171597/dashboard/424735
- **Latest Deployment**: Includes funnel tracking, PostgreSQL storage, and Recharts visualization

## 🔍 Verification Results

| Component | Status | Notes |
|-----------|--------|-------|
| PostHog API | ✅ Working | Events being sent to PostHog |
| Production Env Vars | ✅ Configured | NEXT_PUBLIC_POSTHOG_API_KEY set |
| Event Tracking | ✅ Active | Dual tracking (PostHog + PostgreSQL) |
| Analytics API | ✅ Fixed | Null value handling added |
| Admin Dashboard | ✅ Live | `/admin/analytics` accessible |

## 📊 Why Your PostHog Dashboard Looks Empty

Your PostHog dashboard at https://us.posthog.com/project/171597/dashboard/424735 appears unchanged because:

1. **No Real User Events Yet**
   - The new analytics code was just deployed
   - Users need to interact with your app to generate events
   - Funnels show 0% because there's no data yet

2. **Test Data in Local DB Only**
   - The seeder script (`seed-funnel-data.ts`) populated your LOCAL PostgreSQL
   - That data never reaches PostHog (it's for your custom dashboard only)
   - PostHog only tracks REAL user interactions in production

## 🎯 How to See Data in PostHog

### Option 1: Generate Real User Events (Recommended)

**Step 1: Interact with Your Production App**
1. Open https://www.runsmart-ai.com in an **incognito window**
2. Complete the full user journey:
   ```
   📝 Sign Up → ✅ Complete Onboarding → 📅 Generate Plan → 🏃 Record First Run
   ```

**Step 2: Check PostHog Live Events**
1. Go to: https://us.posthog.com/project/171597/events
2. Filter by recent events (last 5 minutes)
3. You should see:
   ```
   - signup_completed
   - onboarding_started
   - onboarding_step_completed
   - onboarding_completed
   - plan_generated
   - first_run_recorded
   ```

**Step 3: Check Your PostHog Dashboard**
1. Wait 5-10 minutes for PostHog to process events
2. Open: https://us.posthog.com/project/171597/dashboard/424735
3. Create funnel visualizations in PostHog:
   - Go to: Insights → New Insight → Funnel
   - Add steps:
     1. `signup_completed`
     2. `onboarding_completed`
     3. `plan_generated`
     4. `first_run_recorded`
   - Save to your dashboard

### Option 2: Send Test Events Programmatically

Run this command to send test events to PostHog:

```bash
cd V0
node scripts/test-posthog-production.js
```

This will send a test event that you can verify in PostHog Live Events.

## 🏗️ PostHog Dashboard Configuration

Your PostHog dashboard needs to be **configured with insights**. Here's how:

### Create Activation Funnel Insight

1. Go to: https://us.posthog.com/project/171597/insights
2. Click "New Insight" → "Funnel"
3. Configure steps:
   ```
   Step 1: signup_completed
   Step 2: onboarding_completed
   Step 3: plan_generated
   Step 4: first_run_recorded
   ```
4. Name: "Activation Funnel"
5. Click "Save" → "Add to dashboard" → Select dashboard 424735

### Create Challenge Funnel Insight

1. Click "New Insight" → "Funnel"
2. Configure steps:
   ```
   Step 1: challenge_registered
   Step 2: challenge_day_started
   Step 3: challenge_day_completed
   Step 4: challenge_completed
   ```
3. Name: "Challenge Completion Funnel"
4. Save to dashboard

### Create Event Trends

1. Click "New Insight" → "Trends"
2. Select events:
   - `signup_completed`
   - `onboarding_completed`
   - `plan_generated`
   - `first_run_recorded`
3. Name: "Core User Actions"
4. Save to dashboard

## 📈 Your Custom Analytics Dashboard

Your app also has a **custom analytics dashboard** at:
- **URL**: https://www.runsmart-ai.com/admin/analytics
- **Features**:
  - Funnel Visualization (Recharts)
  - Real-time PostgreSQL queries via Supabase
  - Date range filtering (7/30/90 days)
  - Step-by-step breakdown with conversion %

**This dashboard shows different data** because it queries PostgreSQL directly, not PostHog.

### Populate Your Custom Dashboard

**Option 1: Production Seeding (Not Recommended)**
```bash
# Create a production seeder API route (if you want test data)
cd V0
# Modify scripts/seed-funnel-data.ts to use Supabase instead of local DB
# OR manually interact with the app to generate real data
```

**Option 2: Real User Interactions (Recommended)**
- Users interact with your app → Events tracked → PostgreSQL populated → Dashboard shows data

## 🔄 How Dual Tracking Works

```
User Action (e.g., completes signup)
          ↓
   lib/analytics.ts → trackEvent()
          ↓
    ┌─────┴─────┐
    ↓           ↓
PostHog      /api/analytics/events
(External)        ↓
              PostgreSQL (Supabase)
                 ↓
          Custom Dashboard
        (/admin/analytics)
```

**Key Points:**
- **PostHog**: External analytics, session replay, product analytics
- **PostgreSQL**: Your custom metrics, funnel analysis, internal dashboards
- **Both update independently**: PostHog shows live events, PostgreSQL shows your queries

## 🐛 Troubleshooting

### PostHog Events Not Showing

**Check PostHog is initialized:**
```javascript
// Open browser console on https://www.runsmart-ai.com
window.posthog
// Should show PostHog object, not undefined
```

**Check events are being sent:**
```javascript
// In browser console
window.posthog.capture('test_event', { test: true })
// Then check PostHog Live Events
```

**Verify environment variables:**
```bash
cd V0
vercel env ls | grep POSTHOG
# Should show:
# NEXT_PUBLIC_POSTHOG_API_KEY    Encrypted    Production
# NEXT_PUBLIC_POSTHOG_HOST       Encrypted    Production
```

### Custom Dashboard Empty

**Check PostgreSQL connection:**
```bash
cd V0
# Run a test query
curl "https://www.runsmart-ai.com/api/analytics/events?days=7&limit=10"
# Should return JSON with events array
```

**Check Supabase table exists:**
```sql
-- In Supabase SQL editor
SELECT * FROM analytics_events LIMIT 10;
```

**Check events are being stored:**
```javascript
// In browser console on https://www.runsmart-ai.com
fetch('/api/analytics/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventName: 'test_event',
    userId: '123',
    properties: { test: true }
  })
}).then(r => r.json()).then(console.log)
```

## 📝 Summary

**What's Working:**
- ✅ PostHog initialized in production
- ✅ Events being sent to PostHog API
- ✅ Analytics API fixed and working
- ✅ Custom dashboard accessible
- ✅ Dual tracking operational

**What You Need to Do:**
1. **Interact with your production app** to generate events
2. **Configure PostHog dashboard** with funnel insights
3. **Wait 5-10 minutes** for PostHog to process events
4. **Refresh your PostHog dashboard** to see data

**Expected Timeline:**
- **Immediate**: Events visible in PostHog Live Events
- **5-10 minutes**: Events appear in PostHog insights/dashboards
- **24 hours**: Full historical data available for analysis

## 🎉 Next Steps

1. **Test the Full User Flow**
   - Sign up → Onboard → Generate Plan → Record Run
   - Check PostHog Live Events after each step

2. **Configure PostHog Dashboard**
   - Add funnel insights
   - Add trend charts
   - Set up alerts for key metrics

3. **Monitor Your Custom Dashboard**
   - Visit `/admin/analytics`
   - Verify PostgreSQL is storing events
   - Check funnel visualizations

4. **Set Up PostHog Features** (Optional)
   - Session Replay
   - Feature Flags
   - A/B Testing
   - User Surveys

---

**Questions?** Check the verification script:
```bash
cd V0
node scripts/test-posthog-production.js
```

This will run all checks and provide detailed diagnostics.
