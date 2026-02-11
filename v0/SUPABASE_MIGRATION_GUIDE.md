# 🎯 Supabase Analytics Events Migration Guide

## Problem

You tried to run the RLS fix migration but got this error:
```
ERROR: 42P01: relation "analytics_events" does not exist
```

**Root Cause**: The `analytics_events` table was never created in your Supabase production database.

---

## ✅ Solution (3 Steps - 3 Minutes)

### Step 1: Copy the Migration SQL (30 seconds)

Run this command to see the SQL:

```bash
cd V0
node scripts/show-migration-sql.js
```

Or manually copy from: [V0/supabase/migrations/010_complete_analytics_setup.sql](./supabase/migrations/010_complete_analytics_setup.sql)

### Step 2: Run in Supabase SQL Editor (1 minute)

1. **Open Supabase SQL Editor**:
   - Go to: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/sql

2. **Click "New query"**

3. **Paste the SQL** (all 83 lines from the migration file)

4. **Click "Run"** (or press Ctrl/Cmd + Enter)

5. **Wait for success message**:
   ```
   Success. No rows returned
   ```

   OR if the table already exists (shouldn't happen but possible):
   ```
   Success. Rows affected: 0
   ```

### Step 3: Verify Everything Works (1 minute)

Run the diagnostic tool:

```bash
cd V0
node scripts/diagnose-supabase.js
```

**Expected Output:**
```
🔍 Supabase Diagnostics
============================================================

📊 Checking analytics_events table with ANON_KEY...
✅ Table accessible with ANON_KEY
   Found 0 rows

📊 Checking analytics_events table with SERVICE_KEY...
✅ Table accessible with SERVICE_KEY
   Found 0 rows

✍️  Testing INSERT with ANON_KEY...
✅ INSERT successful with ANON_KEY

✍️  Testing INSERT with SERVICE_KEY...
✅ INSERT successful with SERVICE_KEY

============================================================

📊 DIAGNOSIS SUMMARY

✅ analytics_events table is accessible!

✨ Your analytics are working correctly.
   Events should flow to both PostHog and PostgreSQL.

============================================================
```

---

## 🧪 Test Event Tracking

After the migration succeeds, test that events are being tracked:

### A. Test Analytics API

```bash
# Test GET (should return empty array or existing events)
curl "https://www.runsmart-ai.com/api/analytics/events?days=7&limit=5"

# Expected: {"events":[],"eventCounts":{},"totalCount":0,...}
```

### B. Test Event Creation

```bash
# Send a test event
curl -X POST "https://www.runsmart-ai.com/api/analytics/events" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "test_migration_success",
    "userId": "test-user-'$(date +%s)'",
    "properties": {
      "source": "migration_test",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'

# Expected: {"success":true,"timestamp":"..."}
```

### C. Verify in Supabase

Run this query in Supabase SQL Editor:

```sql
SELECT
  event_name,
  user_id,
  properties,
  timestamp
FROM analytics_events
ORDER BY created_at DESC
LIMIT 10;
```

You should see your test event!

---

## 🎯 Generate Real Data

Now that the table is set up, generate real analytics data:

### Option 1: Use Your Production App (Recommended)

1. Open https://www.runsmart-ai.com in **incognito mode**
2. Complete the full user journey:
   ```
   Sign Up → Complete Onboarding → Generate Plan → Record First Run
   ```
3. Check PostHog Live Events: https://us.posthog.com/project/171597/events
4. Check your custom dashboard: https://www.runsmart-ai.com/admin/analytics

### Option 2: Run Local Seeder (Development Only)

```bash
cd V0

# Seed local database with test data
npx tsx scripts/seed-funnel-data.ts

# Then check local dashboard
npm run dev
# Visit: http://localhost:3000/admin/analytics
```

**Note**: The local seeder only populates your LOCAL database, not production PostgreSQL or PostHog.

---

## 📊 Configure PostHog Dashboard

Your PostHog dashboard at https://us.posthog.com/project/171597/dashboard/424735 needs insights:

### Create Activation Funnel

1. Go to: https://us.posthog.com/project/171597/insights/new
2. Select "Funnel"
3. Add steps:
   - Step 1: `signup_completed`
   - Step 2: `onboarding_completed`
   - Step 3: `plan_generated`
   - Step 4: `first_run_recorded`
4. Name: "Activation Funnel"
5. Save & add to dashboard 424735

### Create Event Trend Chart

1. New Insight → "Trends"
2. Select events:
   - `signup_completed`
   - `onboarding_completed`
   - `plan_generated`
   - `first_run_recorded`
3. Date range: Last 30 days
4. Name: "Daily User Actions"
5. Save to dashboard

---

## 🐛 Troubleshooting

### Error: "relation already exists"

If you get this error, it means the table was partially created. Drop it first:

```sql
DROP TABLE IF EXISTS analytics_events CASCADE;
```

Then run the full migration again.

### Error: "permission denied"

Make sure you're using your **service role key**, not the anon key, in Supabase dashboard.

### Table exists but still getting 404

Check RLS policies:

```sql
-- View existing policies
SELECT * FROM pg_policies WHERE tablename = 'analytics_events';

-- If no policies, run the migration again
```

### Events not appearing in dashboard

1. **Check table has data**:
   ```sql
   SELECT COUNT(*) FROM analytics_events;
   ```

2. **Check PostHog Live Events** for recent activity

3. **Clear browser cache** and reload dashboard

4. **Check browser console** for errors:
   - Open DevTools (F12)
   - Look for network errors or JavaScript errors

---

## ✅ Success Checklist

After completing the migration, you should have:

- [x] `analytics_events` table created in Supabase
- [x] 6 RLS policies configured (anon insert, authenticated insert/select, service role full access)
- [x] Proper permissions granted (anon can INSERT, authenticated can INSERT/SELECT)
- [x] Indexes created for query performance
- [x] Cleanup function created (removes events > 90 days old)
- [x] Diagnostic tool shows all green ✅
- [x] Test event successfully inserted
- [x] Analytics API returns data
- [x] PostHog receiving events
- [x] Custom dashboard shows funnel data

---

## 📚 Related Documentation

- **Quick Fix Guide**: [QUICK_FIX_POSTHOG.md](./QUICK_FIX_POSTHOG.md)
- **Full Setup Guide**: [docs/POSTHOG_PRODUCTION_SETUP.md](./docs/POSTHOG_PRODUCTION_SETUP.md)
- **API Reference**: [docs/API-REFERENCE.md](./docs/API-REFERENCE.md)

---

## 🚀 What Happens After Migration

Once the migration is complete:

1. **Events tracked**: Users interact with app → Events sent to both PostHog + PostgreSQL
2. **PostHog dashboard**: Shows live events + configured insights
3. **Custom dashboard**: Shows funnel analysis from PostgreSQL
4. **Analytics API**: Returns event data for custom queries
5. **Auto-cleanup**: Events older than 90 days automatically deleted

---

**Questions?** Run the diagnostic tool for detailed troubleshooting:

```bash
cd V0
node scripts/diagnose-supabase.js
```
