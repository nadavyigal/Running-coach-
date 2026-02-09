/**
 * Supabase Server Utilities
 * 
 * Helper functions for server-side Supabase operations
 */

import { createServerSupabaseClient } from './server-client'

/**
 * Create a server-side Supabase client
 * @returns Supabase client bound to the current request cookies
 */
export async function createClient() {
  return createServerSupabaseClient()
}

/**
 * Get the current authenticated user from Supabase
 * @returns User object or null if not authenticated
 */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error('[supabase:auth] Error getting user:', error)
    return null
  }

  return user
}

/**
 * Get the current user's profile from the profiles table
 * @returns Profile object or null if not found
 */
export async function getCurrentProfile() {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (error) {
    console.error('[supabase:profile] Error getting profile:', error)
    return null
  }

  return profile
}

/**
 * Check if user is authenticated
 * @returns boolean indicating authentication status
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}
