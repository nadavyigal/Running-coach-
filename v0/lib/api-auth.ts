/**
 * Session gate for API routes that spend money (OpenAI calls).
 *
 * Accepts exactly two proofs of identity, and both are validated by Supabase
 * Auth on the server (`auth.getUser`), never decoded or trusted locally:
 *   1. `Authorization: Bearer <Supabase access token>` (native iOS client)
 *   2. The Supabase session cookies set by the web client
 *
 * A bearer value that is not a JWT (the web chat sends `Bearer user-<id>`) or
 * that Supabase rejects falls through to the cookie check. Anything else,
 * including errors and missing env, fails closed with a 401.
 *
 * Usage:
 *   const auth = await requireApiUser(req)
 *   if (auth.response) return auth.response
 */

import 'server-only'

import { createClient, type User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase/server-client'

export type ApiAuthResult =
  | { user: User; response?: undefined }
  | { user?: undefined; response: NextResponse }

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

function readBearerJwt(request: Request): string | null {
  const header = request.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(\S+)$/i)
  const token = match?.[1]
  return token && JWT_SHAPE.test(token) ? token : null
}

async function userFromBearer(token: string, url: string, anonKey: string): Promise<User | null> {
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  return error ? null : data.user ?? null
}

async function userFromCookies(): Promise<User | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user ?? null
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'Sign in to use AI features.', code: 'AUTH_REQUIRED' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function requireApiUser(request: Request): Promise<ApiAuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    console.error('[api-auth] Supabase env is not configured; denying request')
    return { response: unauthorized() }
  }

  const bearer = readBearerJwt(request)
  if (bearer) {
    try {
      const user = await userFromBearer(bearer, url, anonKey)
      if (user) return { user }
    } catch (error) {
      console.error('[api-auth] Bearer validation failed:', error)
    }
  }

  try {
    const user = await userFromCookies()
    if (user) return { user }
  } catch (error) {
    console.error('[api-auth] Cookie session validation failed:', error)
  }

  return { response: unauthorized() }
}
