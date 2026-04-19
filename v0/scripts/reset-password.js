#!/usr/bin/env node
/**
 * Reset a user's password via Supabase Admin API.
 * Usage: node scripts/reset-password.js <email> <new-password>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load env from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: node scripts/reset-password.js <email> <new-password>');
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('Error: Password must be at least 6 characters.');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // First, find the user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('Error listing users:', listError.message);
    process.exit(1);
  }

  const user = users.find(u => u.email === email.toLowerCase());

  if (!user) {
    console.error(`Error: No user found with email "${email}"`);
    process.exit(1);
  }

  console.log(`Found user: ${user.id} (${user.email})`);

  // Update the password
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    console.error('Error updating password:', updateError.message);
    process.exit(1);
  }

  console.log(`Password successfully reset for ${email}`);
  console.log('You can now log in with your new password.');
}

resetPassword().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
