# Supabase Migration Instructions

To apply the migrations to your Supabase database, follow these steps:

## Step 1: Navigate to Your Supabase Project

1. Go to: https://supabase.com/dashboard/project/biilxiuhufkextvwqdob
2. Click on the "SQL Editor" tab

## Step 2: Apply Migrations in Order

### Migration 1: Initial Schema
Copy and paste the contents of `migrations/001_initial_schema.sql` into the SQL Editor and run it.

### Migration 2: RLS Policies
Copy and paste the contents of `migrations/002_rls_policies.sql` into the SQL Editor and run it.

### Migration 3: RPC Function
Copy and paste the contents of `migrations/003_finalize_onboarding_rpc.sql` into the SQL Editor and run it.

## Step 3: Verify Setup

After running all migrations, verify the setup:

1. Check that all tables exist:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

2. Verify RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   ORDER BY tablename;
   ```

3. Check that the RPC function exists:
   ```sql
   SELECT routine_name, routine_type 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name = 'finalize_onboarding';
   ```

## Step 4: Update Environment Variables

1. Get your service role key from: https://supabase.com/dashboard/project/biilxiuhufkextvwqdob/settings/api
2. Update `.env.local` with the actual service role key (replace `your_supabase_service_role_key_here`)

## Step 5: Test the Implementation

Once migrations are applied and environment variables are set:

1. Start the development server: `npm run dev`
2. Navigate to the onboarding flow
3. Complete onboarding to test the `finalize_onboarding` RPC
4. Verify data is created in Supabase tables

## Expected Database Structure

After applying migrations, you should have:

- ✅ `profiles` table with user data
- ✅ `plans` table with single active plan constraint
- ✅ `workouts` table linked to plans
- ✅ `conversations` and `conversation_messages` for chat
- ✅ `idempotency_keys` for atomic operations
- ✅ RLS policies protecting all data
- ✅ `finalize_onboarding` RPC function