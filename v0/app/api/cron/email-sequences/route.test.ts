import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const processEmailSequencesMock = vi.hoisted(() => vi.fn())
const isEmailSequenceStoreConfiguredMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/email/sequences', () => ({
  processEmailSequences: processEmailSequencesMock,
}))

vi.mock('@/lib/server/email-sequence-store', () => ({
  isEmailSequenceStoreConfigured: isEmailSequenceStoreConfiguredMock,
  EmailSequenceDataSourceError: class EmailSequenceDataSourceError extends Error {
    code: 'not_configured' | 'query_failed'

    constructor(message: string, code: 'not_configured' | 'query_failed') {
      super(message)
      this.name = 'EmailSequenceDataSourceError'
      this.code = code
    }
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/cron/email-sequences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    isEmailSequenceStoreConfiguredMock.mockReturnValue(true)
    processEmailSequencesMock.mockResolvedValue({ processed: 2, sent: 1, errors: 0 })
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
    delete process.env.NODE_ENV
  })

  it('returns 401 when cron secret is missing from the request', async () => {
    const { GET } = await loadRoute()
    const response = await GET(new Request('http://localhost/api/cron/email-sequences'))

    expect(response.status).toBe(401)
  })

  it('returns 503 when the Supabase data source is not configured', async () => {
    isEmailSequenceStoreConfiguredMock.mockReturnValue(false)
    const { GET } = await loadRoute()

    const response = await GET(
      new Request('http://localhost/api/cron/email-sequences', {
        headers: { authorization: 'Bearer cron-secret' },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      success: false,
      code: 'not_configured',
    })
    expect(processEmailSequencesMock).not.toHaveBeenCalled()
  })

  it('processes sequences when authorized and configured', async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      new Request('http://localhost/api/cron/email-sequences', {
        headers: { authorization: 'Bearer cron-secret' },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      stats: { processed: 2, sent: 1, errors: 0 },
    })
    expect(processEmailSequencesMock).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when processing fails unexpectedly', async () => {
    processEmailSequencesMock.mockRejectedValue(new Error('Unexpected failure'))
    const { POST } = await loadRoute()

    const response = await POST(
      new Request('http://localhost/api/cron/email-sequences', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({
      success: false,
      error: 'Unexpected failure',
    })
  })
})
