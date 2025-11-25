# 🚀 Supabase Migration Instructions for Story 9.4

## Step 1: Apply Database Migration

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/biilxiuhufkextvwqdob
   - Navigate to "SQL Editor" tab

2. **Execute Migration Script**
   - Copy the entire contents of `supabase/complete-migration.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute

3. **Verify Success**
   - Look for the success message: "Migration completed successfully! 🎉"
   - Check that all tables are created

## Step 2: Test Implementation

Once migration is applied, test the following:

### Test 1: API Endpoints
```bash
# Test profile endpoint (should return onboarding_complete: false initially)
curl http://localhost:3000/api/profile/me

# Test finalize onboarding
curl -X POST http://localhost:3000/api/onboarding/finalize \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "goal": "habit",
      "experience": "beginner",
      "daysPerWeek": 3,
      "preferredTimes": ["07:00"],
      "consents": {
        "data": true,
        "gdpr": true,
        "push": false
      }
    },
    "idempotencyKey": "test-key-123"
  }'
```

### Test 2: Database Verification
Run this SQL in Supabase SQL Editor to verify data:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check profile data
SELECT * FROM profiles;

-- Check plans
SELECT * FROM plans;

-- Check workouts
SELECT * FROM workouts;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

### Test 3: End-to-End Onboarding Flow
1. Start the app: `npm run dev`
2. Navigate to http://localhost:3000
3. Complete the onboarding process
4. Verify it creates profile, plan, and workouts in Supabase

## Expected Results

After successful migration and testing:

✅ **Database Structure:**
- 6 tables created with proper relationships
- RLS enabled on all tables
- Proper indexes for performance
- `finalize_onboarding` RPC function working

✅ **API Endpoints:**
- `/api/profile/me` returns user onboarding status
- `/api/onboarding/finalize` creates complete user setup atomically

✅ **Data Integrity:**
- Single active plan per user constraint
- Proper foreign key relationships
- Idempotent operations working

✅ **Security:**
- Row Level Security policies protecting user data
- Service role authentication working

## Troubleshooting

If you encounter issues:

1. **Migration Fails:**
   - Check error messages in SQL Editor
   - Run individual sections of the migration
   - Verify environment variables are correct

2. **API Errors:**
   - Check console logs in browser dev tools
   - Verify service role key is correct
   - Check Supabase project logs

3. **RLS Issues:**
   - Verify policies are created correctly
   - Check that auth_user_id matches in policies

## Next Steps

Once migration is successful:
1. Test the complete onboarding flow
2. Verify all data appears correctly in Supabase
3. Test that duplicate onboarding calls are handled properly (idempotency)
4. Confirm RLS prevents unauthorized access