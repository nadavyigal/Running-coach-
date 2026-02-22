import 'server-only'

import { decryptToken, encryptToken } from '@/app/api/devices/garmin/token-crypto'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token'
const GARMIN_REVOKE_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/revoke'
const TOKEN_REFRESH_SKEW_SECONDS = 5 * 60
const MAX_REFRESH_RETRIES = 3

type GarminConnectionStatus = 'connected' | 'revoked' | 'error' | 'disconnected'

interface GarminConnectionRow {
  user_id: number
  auth_user_id: string | null
  garmin_user_id: string | null
  scopes: string[] | null
  status: GarminConnectionStatus
  connected_at: string
  revoked_at: string | null
  last_sync_at: string | null
  last_sync_cursor: string | null
  error_state: Record<string, unknown> | null
}

interface GarminTokenRow {
  user_id: number
  auth_user_id: string | null
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  expires_at: string
}

export interface GarminOAuthState {
  userId: number
  authUserId: string | null
  garminUserId: string | null
  scopes: string[]
  status: GarminConnectionStatus
  connectedAt: string
  lastSyncAt: string | null
  lastSyncCursor: string | null
  errorState: Record<string, unknown> | null
  accessToken: string
  refreshToken: string | null
  expiresAt: string
}

interface UpsertGarminConnectionInput {
  userId: number
  authUserId?: string | null
  garminUserId?: string | null
  scopes?: string[]
  status?: GarminConnectionStatus
  connectedAt?: string
  revokedAt?: string | null
  lastSyncAt?: string | null
  lastSyncCursor?: string | null
  errorState?: Record<string, unknown> | null
}

interface UpsertGarminTokensInput {
  userId: number
  authUserId?: string | null
  accessToken: string
  refreshToken?: string | null
  expiresAt: string
  rotatedAt?: string | null
}

interface GarminRefreshResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

function toIsoFromExpiresIn(expiresInSeconds: number | undefined): string {
  const ttl = Number.isFinite(expiresInSeconds) && (expiresInSeconds as number) > 0
    ? (expiresInSeconds as number)
    : 7776000
  return new Date(Date.now() + ttl * 1000).toISOString()
}

function shouldRefreshToken(expiresAtIso: string): boolean {
  const expiresMs = Date.parse(expiresAtIso)
  if (!Number.isFinite(expiresMs)) return true
  const skewMs = TOKEN_REFRESH_SKEW_SECONDS * 1000
  return Date.now() + skewMs >= expiresMs
}

function buildTokenRefreshError(status: number, body: string): Error {
  const message = body.trim().slice(0, 400)
  return new Error(`Garmin token refresh failed (${status}): ${message || 'empty response'}`)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function executeTokenRefresh(params: {
  refreshToken: string
}): Promise<GarminRefreshResponse> {
  const clientId = process.env.GARMIN_CLIENT_ID
  const clientSecret = process.env.GARMIN_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Garmin OAuth client credentials are not configured')
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_REFRESH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(GARMIN_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: params.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      const responseText = await response.text()
      if (!response.ok) {
        const refreshError = buildTokenRefreshError(response.status, responseText)

        const retryable = response.status >= 500 || response.status === 429
        if (!retryable || attempt === MAX_REFRESH_RETRIES) {
          throw refreshError
        }

        lastError = refreshError
        const backoffMs = 500 * 2 ** (attempt - 1)
        await sleep(backoffMs)
        continue
      }

      const tokenPayload = JSON.parse(responseText) as GarminRefreshResponse
      if (!tokenPayload.access_token) {
        throw new Error('Garmin refresh response did not include access_token')
      }

      return tokenPayload
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown Garmin refresh error')
      if (attempt === MAX_REFRESH_RETRIES) break
      const backoffMs = 500 * 2 ** (attempt - 1)
      await sleep(backoffMs)
    }
  }

  throw lastError ?? new Error('Garmin token refresh failed')
}

async function fetchConnectionRow(userId: number): Promise<GarminConnectionRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('garmin_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read garmin_connections: ${error.message}`)
  }

  return (data as GarminConnectionRow | null) ?? null
}

function parseIsoToMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function selectMonotonicCursor(params: {
  existingCursor: string | null
  nextCursor: string | null
}): string | null {
  const existingMs = parseIsoToMs(params.existingCursor)
  const nextMs = parseIsoToMs(params.nextCursor)

  if (existingMs == null && nextMs == null) return params.nextCursor
  if (existingMs == null) return params.nextCursor
  if (nextMs == null) return params.existingCursor
  return nextMs >= existingMs ? params.nextCursor : params.existingCursor
}

async function fetchTokenRow(userId: number): Promise<GarminTokenRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('garmin_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read garmin_tokens: ${error.message}`)
  }

  return (data as GarminTokenRow | null) ?? null
}

export async function upsertGarminConnection(input: UpsertGarminConnectionInput): Promise<void> {
  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()

  const payload = {
    user_id: input.userId,
    ...(input.authUserId !== undefined ? { auth_user_id: input.authUserId } : {}),
    ...(input.garminUserId !== undefined ? { garmin_user_id: input.garminUserId } : {}),
    ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.connectedAt !== undefined ? { connected_at: input.connectedAt } : {}),
    ...(input.revokedAt !== undefined ? { revoked_at: input.revokedAt } : {}),
    ...(input.lastSyncAt !== undefined ? { last_sync_at: input.lastSyncAt } : {}),
    ...(input.lastSyncCursor !== undefined ? { last_sync_cursor: input.lastSyncCursor } : {}),
    ...(input.errorState !== undefined ? { error_state: input.errorState } : {}),
    updated_at: nowIso,
  }

  const { error } = await supabase
    .from('garmin_connections')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw new Error(`Failed to upsert garmin_connections: ${error.message}`)
  }
}

export async function upsertGarminTokens(input: UpsertGarminTokensInput): Promise<void> {
  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()
  const encryptedAccessToken = encryptToken(input.accessToken)
  const encryptedRefreshToken =
    input.refreshToken && input.refreshToken.trim().length > 0 ? encryptToken(input.refreshToken) : null

  const payload = {
    user_id: input.userId,
    ...(input.authUserId !== undefined ? { auth_user_id: input.authUserId } : {}),
    access_token_encrypted: encryptedAccessToken,
    refresh_token_encrypted: encryptedRefreshToken,
    expires_at: input.expiresAt,
    rotated_at: input.rotatedAt ?? nowIso,
    updated_at: nowIso,
  }

  const { error } = await supabase
    .from('garmin_tokens')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw new Error(`Failed to upsert garmin_tokens: ${error.message}`)
  }
}

export async function deleteGarminTokens(userId: number): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('garmin_tokens')
    .delete()
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to delete garmin_tokens: ${error.message}`)
  }
}

export async function getGarminOAuthState(userId: number): Promise<GarminOAuthState | null> {
  const [connection, token] = await Promise.all([
    fetchConnectionRow(userId),
    fetchTokenRow(userId),
  ])

  if (!connection || !token) {
    return null
  }

  let accessToken: string
  let refreshToken: string | null = null

  try {
    accessToken = decryptToken(token.access_token_encrypted)
    refreshToken = token.refresh_token_encrypted ? decryptToken(token.refresh_token_encrypted) : null
  } catch (error) {
    throw new Error(
      `Failed to decrypt Garmin token for user ${userId}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    )
  }

  return {
    userId,
    authUserId: connection.auth_user_id,
    garminUserId: connection.garmin_user_id,
    scopes: connection.scopes ?? [],
    status: connection.status,
    connectedAt: connection.connected_at,
    lastSyncAt: connection.last_sync_at,
    lastSyncCursor: connection.last_sync_cursor,
    errorState: connection.error_state,
    accessToken,
    refreshToken,
    expiresAt: token.expires_at,
  }
}

export async function refreshGarminAccessToken(userId: number): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: string
}> {
  const state = await getGarminOAuthState(userId)
  if (!state?.refreshToken) {
    throw new Error('Garmin refresh token is unavailable. Reconnect Garmin.')
  }

  const refreshed = await executeTokenRefresh({ refreshToken: state.refreshToken })
  const nextRefreshToken = refreshed.refresh_token ?? state.refreshToken
  const expiresAt = toIsoFromExpiresIn(refreshed.expires_in)
  const rotatedAt = new Date().toISOString()

  await upsertGarminTokens({
    userId,
    authUserId: state.authUserId,
    accessToken: refreshed.access_token,
    refreshToken: nextRefreshToken,
    expiresAt,
    rotatedAt,
  })

  await upsertGarminConnection({
    userId,
    authUserId: state.authUserId,
    status: 'connected',
    errorState: null,
  })

  return {
    accessToken: refreshed.access_token,
    refreshToken: nextRefreshToken ?? null,
    expiresAt,
  }
}

export async function getValidGarminAccessToken(userId: number): Promise<string> {
  const state = await getGarminOAuthState(userId)
  if (!state) {
    throw new Error('No Garmin connection found. Connect Garmin first.')
  }

  if (state.status === 'revoked' || state.status === 'disconnected') {
    throw new Error('Garmin connection is not active. Reconnect Garmin.')
  }

  if (!shouldRefreshToken(state.expiresAt)) {
    return state.accessToken
  }

  const refreshed = await refreshGarminAccessToken(userId)
  return refreshed.accessToken
}

export async function markGarminSyncState(params: {
  userId: number
  lastSyncAt?: string
  lastSyncCursor?: string | null
  errorState?: Record<string, unknown> | null
}): Promise<void> {
  let monotonicCursor: string | null | undefined = params.lastSyncCursor
  if (params.lastSyncCursor !== undefined) {
    const currentConnection = await fetchConnectionRow(params.userId)
    monotonicCursor = selectMonotonicCursor({
      existingCursor: currentConnection?.last_sync_cursor ?? null,
      nextCursor: params.lastSyncCursor ?? null,
    })
  }

  await upsertGarminConnection({
    userId: params.userId,
    ...(params.lastSyncAt !== undefined ? { lastSyncAt: params.lastSyncAt } : {}),
    ...(params.lastSyncCursor !== undefined ? { lastSyncCursor: monotonicCursor ?? null } : {}),
    ...(params.errorState !== undefined ? { errorState: params.errorState } : {}),
  })
}

export async function listConnectedGarminUserIds(params?: {
  limit?: number
  offset?: number
}): Promise<number[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('garmin_connections')
    .select('user_id')
    .eq('status', 'connected')
    .order('user_id', { ascending: true })

  if (params?.limit != null) {
    const limit = Math.max(1, params.limit)
    const offset = Math.max(0, params.offset ?? 0)
    query = query.range(offset, offset + limit - 1)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list connected Garmin users: ${error.message}`)
  }

  const result: number[] = []
  for (const row of (data ?? []) as Array<{ user_id?: unknown }>) {
    if (typeof row.user_id === 'number' && Number.isFinite(row.user_id)) {
      result.push(row.user_id)
    }
  }
  return result
}

export async function findRunSmartUserIdsByGarminUserId(garminUserId: string): Promise<number[]> {
  const normalized = garminUserId.trim()
  if (!normalized) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('garmin_connections')
    .select('user_id')
    .eq('garmin_user_id', normalized)

  if (error) {
    throw new Error(`Failed to map Garmin user to RunSmart user: ${error.message}`)
  }

  const mappedUserIds = new Set<number>()
  for (const row of (data ?? []) as Array<{ user_id?: unknown }>) {
    if (typeof row.user_id === 'number' && Number.isFinite(row.user_id)) {
      mappedUserIds.add(row.user_id)
    }
  }
  return Array.from(mappedUserIds)
}

async function revokeTokenUpstream(token: string): Promise<void> {
  const clientId = process.env.GARMIN_CLIENT_ID
  const clientSecret = process.env.GARMIN_CLIENT_SECRET
  if (!clientId || !clientSecret) return

  const response = await fetch(GARMIN_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok && response.status !== 400) {
    const detail = (await response.text()).slice(0, 300)
    throw new Error(`Garmin revoke request failed (${response.status}): ${detail}`)
  }
}

export async function revokeGarminConnection(userId: number): Promise<{
  revokedUpstream: boolean
  hadStoredTokens: boolean
}> {
  const state = await getGarminOAuthState(userId)
  const revokedAt = new Date().toISOString()

  if (!state) {
    await upsertGarminConnection({
      userId,
      status: 'revoked',
      revokedAt,
      errorState: null,
    })
    return {
      revokedUpstream: false,
      hadStoredTokens: false,
    }
  }

  let revokedUpstream = false

  try {
    await revokeTokenUpstream(state.accessToken)
    if (state.refreshToken) {
      await revokeTokenUpstream(state.refreshToken)
    }
    revokedUpstream = true
  } catch (error) {
    logger.warn('Garmin revoke upstream warning:', error)
  }

  await deleteGarminTokens(userId)
  await upsertGarminConnection({
    userId,
    authUserId: state.authUserId,
    status: 'revoked',
    revokedAt,
    errorState: null,
  })

  return {
    revokedUpstream,
    hadStoredTokens: true,
  }
}

export async function markGarminAuthError(userId: number, errorMessage: string): Promise<void> {
  await upsertGarminConnection({
    userId,
    status: 'error',
    errorState: {
      message: errorMessage,
      recordedAt: new Date().toISOString(),
    },
  })
}
