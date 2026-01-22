import type { BetaSignup } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'

export type BetaSignupStorage = 'supabase' | 'memory'

export interface CreateBetaSignupInput {
  email: string
  experienceLevel: BetaSignup['experienceLevel']
  goals: string
  hearAboutUs: string
  createdAt?: Date
  createUserAccount?: boolean // New option to create full user account
}

export interface CreateBetaSignupResult {
  storage: BetaSignupStorage
  created: boolean
  userId?: string // Supabase Auth user ID if account was created
  profileId?: number // Profile ID if account was created
}

type BetaSignupStore = {
  nextId: number
  byEmail: Map<string, BetaSignup>
}

type GlobalWithBetaSignupStore = typeof globalThis & {
  __betaSignupStore?: BetaSignupStore
}

function getStore(): BetaSignupStore {
  const globalWithStore = globalThis as GlobalWithBetaSignupStore
  if (!globalWithStore.__betaSignupStore) {
    globalWithStore.__betaSignupStore = {
      nextId: 1,
      byEmail: new Map(),
    }
  }
  return globalWithStore.__betaSignupStore
}

function getSupabaseConfig():
  | { url: string; serviceRoleKey: string | null; anonKey: string | null }
  | { url: string; serviceRoleKey: null; anonKey: null } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

  if (!url) {
    return { url: '', serviceRoleKey: null, anonKey: null }
  }

  return {
    url,
    serviceRoleKey: serviceRoleKey ? serviceRoleKey : null,
    anonKey: anonKey ? anonKey : null,
  }
}

async function persistToMemory(input: CreateBetaSignupInput): Promise<CreateBetaSignupResult> {
  const store = getStore()
  const normalizedEmail = input.email.toLowerCase()

  const existing = store.byEmail.get(normalizedEmail)
  if (existing) {
    return { storage: 'memory', created: false }
  }

  const createdAt = input.createdAt ?? new Date()
  const signup: BetaSignup = {
    id: store.nextId++,
    email: normalizedEmail,
    experienceLevel: input.experienceLevel,
    goals: input.goals,
    hearAboutUs: input.hearAboutUs,
    createdAt,
  }

  store.byEmail.set(normalizedEmail, signup)
  return { storage: 'memory', created: true }
}

async function persistToSupabase(
  input: CreateBetaSignupInput, 
  config: { url: string; apiKey: string; serviceRoleKey?: string }
): Promise<CreateBetaSignupResult> {
  const normalizedEmail = input.email.toLowerCase()
  
  // If createUserAccount is true, create full Supabase auth user + profile
  if (input.createUserAccount) {
    return await createBetaSignupWithAccount(input, config)
  }

  // Otherwise just create beta_signups entry (old behavior)
  const url = new URL('/rest/v1/beta_signups', config.url)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      email: normalizedEmail,
      experience_level: input.experienceLevel,
      goals: input.goals,
      hear_about_us: input.hearAboutUs,
    }),
  })

  if (response.ok) {
    return { storage: 'supabase', created: true }
  }

  if (response.status === 409) {
    return { storage: 'supabase', created: false }
  }

  const errorText = await response.text().catch(() => '')
  throw new Error(
    `Failed to persist beta signup (${response.status})${errorText ? `: ${errorText}` : ''}`
  )
}

/**
 * Creates a beta signup WITH a full user account
 * This creates:
 * 1. Entry in beta_signups table
 * 2. Supabase Auth user
 * 3. Profile in profiles table
 * 4. Links them together
 */
async function createBetaSignupWithAccount(
  input: CreateBetaSignupInput,
  config: { url: string; apiKey: string; serviceRoleKey?: string }
): Promise<CreateBetaSignupResult> {
  const normalizedEmail = input.email.toLowerCase()
  
  // Use service role key for admin operations (or fall back to provided key)
  const adminKey = config.serviceRoleKey || config.apiKey
  const supabase = createClient(config.url, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // Step 1: Check if beta signup already exists
    const { data: existingBeta, error: checkError } = await supabase
      .from('beta_signups')
      .select('id, auth_user_id')
      .eq('email', normalizedEmail)
      .single()

    if (existingBeta && existingBeta.auth_user_id) {
      // Already has an account
      return { 
        storage: 'supabase', 
        created: false,
        userId: existingBeta.auth_user_id,
      }
    }

    // Step 2: Create Supabase Auth user with temporary password
    const tempPassword = `Beta${Date.now()}${Math.random().toString(36).slice(2)}`
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email for beta users
      user_metadata: {
        is_beta_user: true,
        beta_experience_level: input.experienceLevel,
        beta_goals: input.goals,
      }
    })

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message || 'Unknown error'}`)
    }

    const userId = authData.user.id

    // Step 3: Create profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        auth_user_id: userId,
        email: normalizedEmail,
        experience: input.experienceLevel,
        goal: 'habit', // Default, can be updated during onboarding
        preferred_times: [],
        days_per_week: 3,
        onboarding_complete: false,
        is_beta_user: true,
        subscription_tier: 'premium', // Beta users get premium
        subscription_status: 'trial',
        trial_start_date: new Date().toISOString(),
        trial_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      })
      .select('id')
      .single()

    if (profileError || !profileData) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(userId)
      throw new Error(`Failed to create profile: ${profileError?.message || 'Unknown error'}`)
    }

    const profileId = profileData.id

    // Step 4: Create or update beta_signups entry
    if (existingBeta) {
      // Update existing beta signup
      const { error: updateError } = await supabase
        .from('beta_signups')
        .update({
          auth_user_id: userId,
          profile_id: profileId,
          converted_at: new Date().toISOString(),
        })
        .eq('id', existingBeta.id)

      if (updateError) {
        console.warn('Failed to link beta signup to account:', updateError)
      }
    } else {
      // Create new beta signup
      const { error: betaError } = await supabase
        .from('beta_signups')
        .insert({
          email: normalizedEmail,
          experience_level: input.experienceLevel,
          goals: input.goals,
          hear_about_us: input.hearAboutUs,
          auth_user_id: userId,
          profile_id: profileId,
          converted_at: new Date().toISOString(),
        })

      if (betaError) {
        console.warn('Failed to create beta signup entry:', betaError)
        // Don't fail the whole operation if beta signup creation fails
      }
    }

    return {
      storage: 'supabase',
      created: true,
      userId,
      profileId,
    }
  } catch (error) {
    console.error('Error in createBetaSignupWithAccount:', error)
    throw error
  }
}

export async function createBetaSignup(input: CreateBetaSignupInput): Promise<CreateBetaSignupResult> {
  const normalizedInput: CreateBetaSignupInput = {
    ...input,
    email: input.email.trim().toLowerCase(),
  }

  const supabase = getSupabaseConfig()
  if (supabase.url) {
    if (supabase.serviceRoleKey) {
      try {
        return await persistToSupabase(normalizedInput, { 
          url: supabase.url, 
          apiKey: supabase.serviceRoleKey,
          serviceRoleKey: supabase.serviceRoleKey 
        })
      } catch (error) {
        if (supabase.anonKey) {
          try {
            return await persistToSupabase(normalizedInput, { 
              url: supabase.url, 
              apiKey: supabase.anonKey,
              serviceRoleKey: supabase.serviceRoleKey 
            })
          } catch (anonError) {
            if (process.env.NODE_ENV !== 'production') {
              return await persistToMemory(normalizedInput)
            }
            throw anonError
          }
        }

        if (process.env.NODE_ENV !== 'production') {
          return await persistToMemory(normalizedInput)
        }
        throw error
      }
    }

    if (supabase.anonKey) {
      try {
        return await persistToSupabase(normalizedInput, { 
          url: supabase.url, 
          apiKey: supabase.anonKey 
        })
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          return await persistToMemory(normalizedInput)
        }
        throw error
      }
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Supabase is not configured (set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)'
    )
  }

  return await persistToMemory(normalizedInput)
}
