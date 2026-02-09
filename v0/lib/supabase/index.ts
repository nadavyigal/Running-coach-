/**
 * Supabase Module Entry Point
 * 
 * Exports all Supabase utilities for easy importing
 */

export { createClient } from './client'
export { createServerSupabaseClient, createServiceRoleClient } from './server-client'
export { createClient as createServerClient, getCurrentUser, getCurrentProfile, isAuthenticated } from './server'
