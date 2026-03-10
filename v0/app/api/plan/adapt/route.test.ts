import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getUser: vi.fn(),
    getActivePlan: vi.fn(),
    getPlan: vi.fn(),
  },
}))

vi.mock('@/lib/planAdaptationEngine', () => ({
  planAdaptationEngine: {
    shouldAdaptPlan: vi.fn(),
    adaptExistingPlan: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/server/plan-adjustments', () => ({
  recordPlanAdjustment: vi.fn(),
}))

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  } as NextRequest
}

describe('POST /api/plan/adapt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects auto-adaptation requests outside the local Dexie boundary', async () => {
    const response = await POST(makeRequest({
      planId: 10,
      userId: 7,
      adaptationReason: 'performance_below_target',
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Automatic completion-loop adaptation is local-only and must run in the browser-backed Dexie flow.',
      code: 'LOCAL_DB_BOUNDARY',
    })
  })
})
