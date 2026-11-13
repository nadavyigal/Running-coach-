# 🚀 Quick Fix: PostHog Dashboard Setup

## ❌ Current Issue

Your PostHog dashboard looks empty because:
1. ✅ PostHog is working and sending events
2. ❌ Supabase `analytics_events` table has restrictive RLS policies
3. ❌ Events can't be stored in PostgreSQL (blocked by RLS)
4. ❌ Custom dashboard `/admin/analytics` has no data to display

## ✅ The Fix (3 Steps - 5 Minutes)

### Step 1: Run Supabase Migration (1 minute)

**Option A: Using Supabase Dashboard (Recommended)**

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/sql

2. Click "New query"

3. Copy and paste this SQL:

```sql
-- Fix RLS policies for analytics_events
DROP POLICY IF EXISTS "Admin users can view all analytics events" ON analytics_events;

CREATE POLICY "Allow anonymous event inserts"
  ON analytics_events FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated users can insert events"
  ON analytics_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view all events"
  ON analytics_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role has full access"
  ON analytics_events FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT INSERT ON analytics_events TO anon;
GRANT INSERT, SELECT ON analytics_events TO authenticated;
GRANT ALL ON analytics_events TO service_role;
```

4. Click "Run" (or press Cmd/Ctrl + Enter)

5. You should see "Success. No rows returned"

**Option B: Using Supabase CLI**

```bash
cd V0
supabase db push --migrations supabase/migrations/009_fix_analytics_rls.sql
```

### Step 2: Verify the Fix (1 minute)

Run the diagnostic script:

```bash
cd V0
node scripts/diagnose-supabase.js
```

Expected output:
```
✅ Table accessible with ANON_KEY
✅ INSERT successful with ANON_KEY
✅ analytics_events table is accessible!
```

### Step 3: Test Events (3 minutes)

**A. Test the Analytics API:**

```bash
curl "https://www.runsmart-ai.com/api/analytics/events?days=7&limit=5"
```

Expected: JSON response with events array (may be empty if no users yet)

**B. Test Event Creation:**

```bash
curl -X POST "https://www.runsmart-ai.com/api/analytics/events" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "test_manual_event",
    "userId": "test-user-123",
    "properties": {
      "source": "manual_test",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

Expected: `{"success":true,"timestamp":"..."}`

**C. Verify in Supabase:**

```sql
-- Run in Supabase SQL Editor
SELECT * FROM analytics_events
ORDER BY created_at DESC
LIMIT 10;
```

You should see your test event!

## 🎯 Now Generate Real Data

### Option 1: Use Your Production App

1. Open https://www.runsmart-ai.com in **incognito mode**
2. Complete user journey:
   - Sign up → Complete onboarding → Generate plan → Record run
3. Check PostHog Live Events: https://us.posthog.com/project/171597/events
4. Check custom dashboard: https://www.runsmart-ai.com/admin/analytics

### Option 2: Seed Test Data (Optional)

**⚠️ WARNING**: This sends fake data to production. Only use for testing!

```bash
cd V0

# Create production seeder (modify the local seeder)
cat > scripts/seed-production.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Load env
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match && !line.startsWith('#')) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  })
}

async function seedEvent(eventName, properties) {
  const response = await fetch('https://www.runsmart-ai.com/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName,
      userId: `seed-user-${Date.now()}`,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        source: 'seed_script'
      }
    })
  })
  return response.json()
}

async function main() {
  console.log('🌱 Seeding production with test events...')

  // Activation funnel
  for (let i = 1; i <= 100; i++) {
    const userId = `seed-user-${i}`

    await seedEvent('signup_completed', { userId })
    if (i <= 80) await seedEvent('onboarding_completed', { userId })
    if (i <= 65) await seedEvent('plan_generated', { userId })
    if (i <= 52) await seedEvent('first_run_recorded', { userId })

    process.stdout.write(`\rProgress: ${i}/100`)
  }

  console.log('\n✅ Seeding complete!')
  console.log('Check: https://www.runsmart-ai.com/admin/analytics')
}

main().catch(console.error)
EOF

# Run seeder
node scripts/seed-production.js
```

## 📊 PostHog Dashboard Configuration

Your PostHog dashboard at https://us.posthog.com/project/171597/dashboard/424735 is empty because it doesn't have any **insights** configured yet.

### Add Funnel Visualization

1. Go to: https://us.posthog.com/project/171597/insights/new
2. Select "Funnel"
3. Add steps:
   ```
   Step 1: signup_completed
   Step 2: onboarding_completed
   Step 3: plan_generated
   Step 4: first_run_recorded
   ```
4. Name: "Activation Funnel"
5. Click "Save & add to dashboard"
6. Select dashboard 424735

### Add Trend Chart

1. New Insight → "Trends"
2. Select events:
   - `signup_completed`
   - `onboarding_completed`
   - `plan_generated`
   - `first_run_recorded`
3. Name: "Daily User Actions"
4. Save to dashboard

## ✅ Final Verification

After the fix, verify everything works:

```bash
cd V0

# 1. Check Supabase connection
node scripts/diagnose-supabase.js

# 2. Check PostHog integration
node scripts/test-posthog-production.js

# 3. Check analytics API
curl "https://www.runsmart-ai.com/api/analytics/events?days=7"

# 4. Open dashboards
open https://www.runsmart-ai.com/admin/analytics
open https://us.posthog.com/project/171597/dashboard/424735
```

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ Diagnostic script shows "analytics_events table is accessible!"
2. ✅ PostHog Live Events shows your test events
3. ✅ Custom dashboard `/admin/analytics` shows funnel data
4. ✅ PostHog dashboard shows configured insights with data
5. ✅ Real users generate events that appear in both systems

## 🐛 Still Not Working?

Run these checks:

```bash
# Check table exists
curl -X GET "https://dxqglotcyirxzyqaxqln.supabase.co/rest/v1/analytics_events?limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"

# Should return: [...]  (array, even if empty)
# Not: {"code":"42P01","message":"relation \"public.analytics_events\" does not exist"}
```

If you see the error message, the table doesn't exist. Run migration 008 first:

```sql
-- In Supabase SQL Editor
-- Copy from V0/supabase/migrations/008_analytics_events.sql
```

## 📚 Additional Resources

- **PostHog Docs**: https://posthog.com/docs
- **Supabase RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **Your Documentation**:
  - [V0/docs/POSTHOG_PRODUCTION_SETUP.md](./docs/POSTHOG_PRODUCTION_SETUP.md)
  - [V0/docs/API-REFERENCE.md](./docs/API-REFERENCE.md)

---

**Questions?** Check `/tmp/phase3_summary.txt` for the original implementation summary.
