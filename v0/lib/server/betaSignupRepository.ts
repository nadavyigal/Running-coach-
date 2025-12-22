import type { BetaSignup } from '@/lib/db'

export type BetaSignupStorage = 'supabase' | 'memory'

export interface CreateBetaSignupInput {
  email: string
  experienceLevel: BetaSignup['experienceLevel']
  goals: string
  hearAboutUs: string
  createdAt?: Date
}

export interface CreateBetaSignupResult {
  storage: BetaSignupStorage
  created: boolean
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
  | { url: string; serviceRoleKey: string }
  | { url: string; serviceRoleKey: null } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''

  if (!url) {
    return { url: '', serviceRoleKey: null }
  }

  return {
    url,
    serviceRoleKey: serviceRoleKey ? serviceRoleKey : null,
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

async function persistToSupabase(input: CreateBetaSignupInput, config: { url: string; serviceRoleKey: string }) {
  const url = new URL('/rest/v1/beta_signups', config.url)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      email: input.email.toLowerCase(),
      experience_level: input.experienceLevel,
      goals: input.goals,
      hear_about_us: input.hearAboutUs,
    }),
  })

  if (response.ok) {
    return { storage: 'supabase' as const, created: true }
  }

  if (response.status === 409) {
    return { storage: 'supabase' as const, created: false }
  }

  const errorText = await response.text().catch(() => '')
  throw new Error(
    `Failed to persist beta signup (${response.status})${errorText ? `: ${errorText}` : ''}`
  )
}

export async function createBetaSignup(input: CreateBetaSignupInput): Promise<CreateBetaSignupResult> {
  const normalizedInput: CreateBetaSignupInput = {
    ...input,
    email: input.email.trim().toLowerCase(),
  }

  const supabase = getSupabaseConfig()
  if (supabase.url && !supabase.serviceRoleKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to persist beta signups in production')
    }
    return await persistToMemory(normalizedInput)
  }

  if (supabase.url && supabase.serviceRoleKey) {
    try {
      return await persistToSupabase(normalizedInput, { url: supabase.url, serviceRoleKey: supabase.serviceRoleKey })
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // If Supabase is misconfigured/unreachable, avoid losing signups in local dev.
        return await persistToMemory(normalizedInput)
      }
      throw error
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase is not configured (set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)')
  }

  return await persistToMemory(normalizedInput)
}
