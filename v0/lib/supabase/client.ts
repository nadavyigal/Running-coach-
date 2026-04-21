/**
 * Supabase Client Utilities
 * 
 * This module provides client-side and server-side Supabase clients
 * for interacting with the Supabase backend.
 */

import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | undefined;

// Client-side Supabase client (for use in React components) — singleton to prevent multiple GoTrueClient instances
export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

// Server-side Supabase clients live in lib/supabase/server-client.ts
