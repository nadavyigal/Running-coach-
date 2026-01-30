# 🚀 Run This Migration

## The Problem

The previous migration failed because the `beta_signups` table already existed from an earlier migration WITHOUT the `auth_user_id` column. The `CREATE TABLE IF NOT EXISTS` statement doesn't add new columns to existing tables.

## The Solution

Use **`migrations/003-fix-beta-signups-schema.sql`** instead. This migration:
1. ✅ Drops the old `beta_signups` table (safe in development)
2. ✅ Creates new `beta_signups` table with ALL required columns
3. ✅ Creates `profiles` table with proper schema
4. ✅ Adds all indexes, RLS policies, and triggers
5. ✅ Includes verification queries at the end

---

## 📋 Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

👉 https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/sql/new

### Step 2: Copy the SQL

Open file: `migrations/003-fix-beta-signups-schema.sql`

Copy the **ENTIRE contents** (all ~230 lines)

### Step 3: Paste and Run

1. Paste into SQL Editor
2. Click **"Run"** button
3. Wait for completion

### Step 4: Verify Success

You should see output showing:
```
beta_signups columns:
- id
- email
- experience_level
- goals
- hear_about_us
- created_at
- invited_at
- converted_at
- auth_user_id  ← This should NOW exist!
- profile_id

profiles columns:
- id
- auth_user_id
- email
- goal
- experience
- ... (and more)
- is_beta_user  ← This should exist!
- beta_signup_id
```

---

## ✅ What This Migration Does

### Creates `beta_signups` table with:
- `id` - Primary key
- `email` - Unique email address
- `experience_level` - beginner/intermediate/advanced
- `goals` - JSON array as text
- `hear_about_us` - Marketing source
- `created_at` - Signup timestamp
- **`auth_user_id`** - Links to Supabase Auth user ← KEY COLUMN
- **`profile_id`** - Links to profiles table ← KEY COLUMN
- `converted_at` - When beta user got full account
- `invited_at` - When we sent invite

### Creates `profiles` table with:
- `id` - Primary key
- `auth_user_id` - Links to Supabase Auth user
- `email` - User email
- Onboarding fields (goal, experience, etc.)
- **`is_beta_user`** - TRUE for beta signups ← KEY COLUMN
- **`beta_signup_id`** - Links back to beta_signups ← KEY COLUMN
- Subscription fields (tier, status, trial dates)
- Timestamps

### Sets up:
- ✅ Indexes on all foreign keys
- ✅ RLS policies for secure access
- ✅ Triggers for `updated_at`
- ✅ Helper function `link_beta_signup_to_profile()`

---

## 🧪 Test After Migration

### Test 1: Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('beta_signups', 'profiles');
```
Should return 2 rows.

### Test 2: Verify Columns
```sql
-- Check beta_signups has auth_user_id
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'beta_signups' 
  AND column_name = 'auth_user_id';
```
Should return 1 row.

### Test 3: Insert Test Data
```sql
-- Insert test beta signup
INSERT INTO beta_signups (email, experience_level, goals, hear_about_us)
VALUES ('test@example.com', 'beginner', '["habit"]', 'search');

-- Verify it worked
SELECT * FROM beta_signups WHERE email = 'test@example.com';
```

---

## 🚨 Important Notes

### Data Loss Warning
⚠️ **This migration drops the `beta_signups` table!**

If you have production data in `beta_signups`, you should:
1. Export the data first: `COPY beta_signups TO '/tmp/beta_signups_backup.csv' CSV HEADER;`
2. Run the migration
3. Import the data back (you'll need to map old columns to new columns)

Since you're in development, this should be safe.

### Foreign Key Constraints
The migration comments out foreign key constraints to `auth.users` because:
- Supabase manages the `auth.users` table
- Adding FK constraints might require elevated permissions
- The code enforces referential integrity

If you want to add these constraints later:
```sql
ALTER TABLE beta_signups ADD CONSTRAINT fk_beta_auth_user 
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_auth_user 
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

---

## 🎯 After Migration Complete

1. ✅ Run migration: `003-fix-beta-signups-schema.sql`
2. ✅ Verify tables exist with correct columns
3. ✅ Deploy code to Vercel (if not already done)
4. ✅ Test beta signup: https://runsmart-ai.com/landing/beta-signup
5. ✅ Test app signup: https://runsmart-ai.com

---

## 📞 If You Get Errors

### Error: "permission denied"
**Solution:** Make sure you're running as the Supabase project owner or have sufficient permissions.

### Error: "table does not exist" when dropping
**Solution:** That's fine! The `DROP TABLE IF EXISTS` handles this gracefully.

### Error: "relation auth.users does not exist"
**Solution:** The foreign key constraints are commented out. That's intentional.

---

## ✨ Success Looks Like

After running this migration successfully:

```sql
-- This query should work without errors:
SELECT 
  bs.email,
  bs.auth_user_id,
  bs.profile_id,
  bs.converted_at
FROM beta_signups bs;

-- And this should work:
SELECT 
  p.email,
  p.is_beta_user,
  p.beta_signup_id
FROM profiles p;
```

**Ready to run!** 🚀

Just copy `migrations/003-fix-beta-signups-schema.sql` into Supabase SQL Editor and click Run.
