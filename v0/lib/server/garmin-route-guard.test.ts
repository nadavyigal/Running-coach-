import { readdirSync } from 'node:fs'
import path from 'node:path'

import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GARMIN_CONNECT_DISABLED_MESSAGE } from '@/lib/server/garmin-connect-gate'

const createAdminClientMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('A blocked route must not use the Supabase service key')
  })
)

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))

type Handler = (req: NextRequest, context: { params: Record<string, string> }) => Promise<Response>
type RouteModule = Partial<Record<'GET' | 'POST', unknown>>

const BLOCKED_ROUTES: Array<{ route: string; methods: Array<'GET' | 'POST'>; load: () => Promise<RouteModule> }> = [
  { route: 'devices/garmin/activities', methods: ['GET'], load: () => import('@/app/api/devices/garmin/activities/route') },
  { route: 'devices/garmin/backfill', methods: ['POST'], load: () => import('@/app/api/devices/garmin/backfill/route') },
  { route: 'devices/garmin/callback', methods: ['POST'], load: () => import('@/app/api/devices/garmin/callback/route') },
  { route: 'devices/garmin/connect', methods: ['POST'], load: () => import('@/app/api/devices/garmin/connect/route') },
  { route: 'devices/garmin/diagnose', methods: ['GET'], load: () => import('@/app/api/devices/garmin/diagnose/route') },
  { route: 'devices/garmin/runs', methods: ['GET'], load: () => import('@/app/api/devices/garmin/runs/route') },
  { route: 'devices/garmin/sleep', methods: ['GET'], load: () => import('@/app/api/devices/garmin/sleep/route') },
  { route: 'devices/garmin/status', methods: ['GET'], load: () => import('@/app/api/devices/garmin/status/route') },
  { route: 'devices/garmin/sync', methods: ['GET', 'POST'], load: () => import('@/app/api/devices/garmin/sync/route') },
  { route: 'devices/garmin/sync/incremental', methods: ['POST'], load: () => import('@/app/api/devices/garmin/sync/incremental/route') },
  { route: 'devices/garmin/sync/manual', methods: ['POST'], load: () => import('@/app/api/devices/garmin/sync/manual/route') },
  { route: 'garmin/activities/[activityId]/recap', methods: ['GET'], load: () => import('@/app/api/garmin/activities/[activityId]/recap/route') },
  { route: 'garmin/activity-telemetry', methods: ['GET'], load: () => import('@/app/api/garmin/activity-telemetry/route') },
  { route: 'garmin/dashboard', methods: ['GET'], load: () => import('@/app/api/garmin/dashboard/route') },
  { route: 'garmin/insights', methods: ['GET'], load: () => import('@/app/api/garmin/insights/route') },
  { route: 'garmin/metrics/readiness', methods: ['GET'], load: () => import('@/app/api/garmin/metrics/readiness/route') },
  { route: 'garmin/reports/weekly', methods: ['GET', 'POST'], load: () => import('@/app/api/garmin/reports/weekly/route') },
  { route: 'garmin/status', methods: ['GET'], load: () => import('@/app/api/garmin/status/route') },
  { route: 'garmin/sync', methods: ['POST'], load: () => import('@/app/api/garmin/sync/route') },
]

// Garmin routes that stay reachable, with the check that protects each one.
const OPEN_ROUTES = [
  'devices/garmin/disconnect', // signed-in owner of the connection
  'devices/garmin/webhook', // Garmin webhook secret
  'devices/garmin/webhook/[token]', // Garmin webhook secret
  'garmin/first-aha', // signed-in owner of the connection
  'garmin/pmc', // signed-in user, rows filtered by auth_user_id
]

function buildRequest(route: string, method: 'GET' | 'POST'): NextRequest {
  const url = `http://localhost/api/${route}?userId=1&activityId=a1&date=2026-11-26`
  const headers = {
    'content-type': 'application/json',
    'x-user-id': '1',
    authorization: 'Bearer not-a-real-token',
  }

  return method === 'POST'
    ? new NextRequest(url, { method, headers, body: JSON.stringify({ userId: 1, code: 'code', state: 'state' }) })
    : new NextRequest(url, { method, headers })
}

describe('switched-off Garmin routes', () => {
  // The security wrapper on connect/callback posts its own metrics with fetch,
  // so only calls that reach Garmin count as a leak.
  const fetchMock = vi.fn(async (_input: unknown) => new Response(null, { status: 204 }))
  const garminCalls = () => fetchMock.mock.calls.filter(([input]) => String(input).includes('garmin.com'))

  beforeAll(() => {
    vi.stubGlobal('fetch', fetchMock)
    // The old connect flag must not be able to reopen anything.
    vi.stubEnv('GARMIN_CONNECT_ENABLED', 'true')
  })

  afterAll(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    createAdminClientMock.mockClear()
    fetchMock.mockClear()
  })

  const cases = BLOCKED_ROUTES.flatMap(({ route, methods, load }) =>
    methods.map((method) => ({ route, method, load }))
  )

  it.each(cases)(
    '$method /api/$route answers 503 without touching user data',
    async ({ route, method, load }) => {
      const handler = (await load())[method] as Handler

      const res = await handler(buildRequest(route, method), { params: { activityId: 'a1' } })
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body).toEqual({
        success: false,
        error: GARMIN_CONNECT_DISABLED_MESSAGE,
        code: 'GARMIN_UNAVAILABLE',
      })
      expect(createAdminClientMock).not.toHaveBeenCalled()
      expect(garminCalls()).toEqual([])
    },
    30_000
  )

  it('classifies every route in the Garmin API folders as switched off or protected', () => {
    const apiDir = path.resolve(__dirname, '../../app/api')
    const found = ['garmin', 'devices/garmin'].flatMap((root) =>
      (readdirSync(path.join(apiDir, root), { recursive: true }) as string[])
        .filter((file) => path.basename(file) === 'route.ts')
        .map((file) => path.posix.join(root, path.dirname(file).split(path.sep).join('/')))
    )

    expect(found.sort()).toEqual([...BLOCKED_ROUTES.map((entry) => entry.route), ...OPEN_ROUTES].sort())
  })
})
