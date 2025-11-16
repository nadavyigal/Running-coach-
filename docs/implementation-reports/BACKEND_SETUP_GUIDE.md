# 🚀 Complete Backend Setup Guide

## Current Status
✅ **Tables exist**: All required tables are created  
❌ **Critical constraint missing**: `profiles.auth_user_id` unique constraint  
❌ **Function fails**: `finalize_onboarding` cannot execute ON CONFLICT  

## Required Actions

### Step 1: Apply Critical Fix (URGENT)

Open the Supabase Dashboard → SQL Editor and execute:

```sql
-- CRITICAL FIX: Add missing unique constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_auth_user_id_unique UNIQUE (auth_user_id);

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conname = 'profiles_auth_user_id_unique';
```

**Expected Result**: Should return one row showing `constraint_name: profiles_auth_user_id_unique`

### Step 2: Test the Fix

After applying the constraint, test the function:

```sql
SELECT finalize_onboarding(
    '{"name": "Test User", "goal": "habit", "experience": "beginner", "daysPerWeek": 3, "preferredTimes": ["07:00"], "consents": {"data": true, "gdpr": true, "push": false}}'::jsonb,
    'test-constraint-fix'
);
```

**Expected Result**: Should return success JSON without the constraint error.

### Step 3: Apply Complete Migrations (if not already done)

If any issues persist, apply these in order through the Supabase SQL Editor:

1. **Initial Schema** (`supabase/migrations/001_initial_schema.sql`)
2. **RLS Policies** (`supabase/migrations/002_rls_policies.sql`)  
3. **RPC Function** (`supabase/migrations/003_finalize_onboarding_rpc.sql`)
4. **Critical Fix** (`supabase/CRITICAL_FIX.sql`)

## Verification Steps

### 1. Run Backend Diagnostics
```bash
cd V0
node scripts/simple-migration.js
```

### 2. Test API Endpoints
```bash
# Start the dev server (if not running)
npm run dev

# Test onboarding endpoint
curl -X POST http://localhost:3000/api/onboarding/finalize \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","goal":"habit","experience":"beginner","daysPerWeek":3,"preferredTimes":["07:00"],"consents":{"data":true,"gdpr":true,"push":false}}'
```

### 3. Run End-to-End Tests
```bash
npm run test:e2e
```

## Expected Results After Fix

### ✅ Backend Should Support:
- ✅ User profile creation and updates
- ✅ Plan generation and management  
- ✅ Workout scheduling and tracking
- ✅ Chat conversations with AI
- ✅ Row-level security (RLS)
- ✅ Atomic operations with idempotency

### ✅ API Endpoints Should Work:
- `POST /api/onboarding/finalize` - Complete user onboarding
- `GET /api/profile` - Get user profile
- `POST /api/chat` - AI chat interactions
- `GET /api/plans` - Get user plans and workouts

### ✅ Database Features:
- Proper foreign key relationships
- Unique constraints preventing duplicates
- RLS policies protecting user data
- Automatic timestamp updates
- Idempotency key management

## Security Configuration

### RLS Policies Applied:
- **Profiles**: Users can only access their own profile
- **Plans**: Users can only access plans linked to their profile  
- **Workouts**: Users can only access workouts from their plans
- **Conversations**: Users can only access their own conversations
- **Messages**: Users can only access messages from their conversations
- **Idempotency Keys**: Users can only access their own keys

### Performance Indexes:
- `profiles.auth_user_id` (unique constraint + index)
- `plans.profile_id` and `plans.is_active`
- `workouts.plan_id` and `workouts.scheduled_date`
- `conversations.profile_id`
- `conversation_messages.conversation_id`
- `idempotency_keys.key` and `idempotency_keys.expires_at`

## Troubleshooting

### Issue: "Transport is closed" (MCP)
**Solution**: Use manual SQL execution via Supabase Dashboard

### Issue: "User not authenticated" 
**Solution**: Expected behavior - function requires valid auth session

### Issue: "no unique or exclusion constraint"
**Solution**: Apply the critical fix (Step 1 above)

### Issue: Tables don't exist
**Solution**: Apply the initial schema migration first

## Testing Checklist

- [ ] Unique constraint added to profiles.auth_user_id
- [ ] finalize_onboarding function executes without constraint errors
- [ ] All tables are accessible via API
- [ ] RLS policies prevent unauthorized access
- [ ] End-to-end tests pass
- [ ] Onboarding flow completes successfully
- [ ] Chat functionality works
- [ ] Plan generation works

## Next Steps After Backend Fix

1. **Complete Epic 4 Testing**: Run the full test suite
2. **Performance Optimization**: Monitor query performance
3. **Security Audit**: Verify RLS policies are comprehensive
4. **Data Migration**: If moving from local database, plan data migration
5. **Monitoring Setup**: Configure error tracking and performance monitoring