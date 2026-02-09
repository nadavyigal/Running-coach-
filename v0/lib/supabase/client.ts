/**
 * Supabase Client Utilities
 * 
 * This module provides client-side and server-side Supabase clients
 * for interacting with the Supabase backend.
 */

import { createBrowserClient } from '@supabase/ssr';

// Client-side Supabase client (for use in React components)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server-side Supabase clients live in lib/supabase/server-client.ts
