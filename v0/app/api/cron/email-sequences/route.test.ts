import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const { processEmailSequences } = vi.hoisted(() => ({ processEmailSequences: vi.fn() }))
vi.mock('@/lib/email/sequences', () => ({ processEmailSequences }))

import { GET, POST } from './route'

const cronRequest = (method: 'GET' | 'POST') =>
  new Request('http://localhost/api/cron/email-sequences', {
    method,
    headers: { authorization: 'Bearer any-secret' },
  })

describe('/api/cron/email-sequences (disabled)', () => {
  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s returns 503 disabled without processing sequences', async (method, handler) => {
    const response = await handler(cronRequest(method))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      success: false,
      disabled: true,
      reason: 'email_sequences_disabled',
    })
    expect(processEmailSequences).not.toHaveBeenCalled()
  })

  it('is not scheduled in vercel.json', () => {
    const vercelConfig = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../../../vercel.json'), 'utf8')
    ) as { crons?: { path: string }[] }

    const paths = (vercelConfig.crons ?? []).map((cron) => cron.path)
    expect(paths).not.toContain('/api/cron/email-sequences')
  })
})
