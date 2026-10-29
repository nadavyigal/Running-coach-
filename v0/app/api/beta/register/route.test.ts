import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rateLimiter } from '@/lib/security.config'
import { POST } from './route'

const VALID_BODY = {
  fullName: 'Dana Runner',
  email: 'Dana@Example.com',
  linkedinUrl: 'https://www.linkedin.com/in/dana-runner',
  country: 'Israel',
  hasIphone: 'yes',
  goal: 'race',
  raceDate: '2027-03-12',
  returningAfterBreak: 'yes',
  runsPerWeekNow: '1-2',
  source: 'LinkedIn',
  utmCampaign: 'beta_dm_oct',
  consent: true,
  hpField: '',
}

function makeRequest(body: unknown, ip = '203.0.113.7') {
  return new Request('http://localhost/api/beta/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function mockWebhook(status: number, payload: unknown) {
  const fetchMock = vi.fn().mockImplementation(async () =>
    new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), { status })
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('POST /api/beta/register', () => {
  beforeEach(() => {
    rateLimiter.reset()
    vi.stubEnv('BETA_SHEET_WEBHOOK_URL', 'https://script.google.com/macros/s/test/exec')
    vi.stubEnv('BETA_SHEET_WEBHOOK_SECRET', 'test-secret')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends a valid registration to the sheet webhook as one row', async () => {
    const fetchMock = mockWebhook(200, { ok: true })

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://script.google.com/macros/s/test/exec')
    const sent = JSON.parse(init.body as string)
    expect(sent.secret).toBe('test-secret')
    expect(sent.row).toEqual({
      submitted_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      full_name: 'Dana Runner',
      email_for_app: 'dana@example.com',
      linkedin_url: 'https://www.linkedin.com/in/dana-runner',
      country: 'Israel',
      has_iphone: 'yes',
      goal: 'Race or target date',
      race_date: '2027-03-12',
      returning_after_break: 'yes',
      runs_per_week_now: '1-2',
      source: 'linkedin',
      utm_campaign: 'beta_dm_oct',
      consent: 'yes',
    })
  })

  it('defaults source to direct and leaves optional fields empty', async () => {
    const fetchMock = mockWebhook(200, { ok: true })
    const { linkedinUrl: _l, raceDate: _r, source: _s, utmCampaign: _u, ...minimal } = VALID_BODY

    const response = await POST(makeRequest(minimal))

    expect(response.status).toBe(200)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(sent.row).toMatchObject({ linkedin_url: '', race_date: '', source: 'direct', utm_campaign: '' })
  })

  it('rejects an invalid registration without calling the webhook', async () => {
    const fetchMock = mockWebhook(200, { ok: true })

    const response = await POST(
      makeRequest({ ...VALID_BODY, email: 'not-an-email', consent: false, linkedinUrl: 'https://evil.example/x' })
    )

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(Object.keys(data.fields)).toEqual(expect.arrayContaining(['email', 'consent', 'linkedinUrl']))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a LinkedIn lookalike host', async () => {
    mockWebhook(200, { ok: true })

    const response = await POST(makeRequest({ ...VALID_BODY, linkedinUrl: 'https://linkedin.com.evil.example/in/x' }))

    expect(response.status).toBe(400)
  })

  it('rejects a body that is not JSON', async () => {
    const fetchMock = mockWebhook(200, { ok: true })

    const response = await POST(makeRequest('not json'))

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers success to a filled honeypot but drops the row', async () => {
    const fetchMock = mockWebhook(200, { ok: true })

    const response = await POST(makeRequest({ ...VALID_BODY, hpField: 'https://spam.example' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 503 when the webhook env vars are missing', async () => {
    vi.stubEnv('BETA_SHEET_WEBHOOK_SECRET', '')
    const fetchMock = mockWebhook(200, { ok: true })

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 502 when Apps Script does not confirm the row', async () => {
    mockWebhook(200, '<html>Sign in</html>')

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(502)
  })

  it('returns 502 when the webhook rejects the secret', async () => {
    mockWebhook(200, { ok: false, error: 'unauthorized' })

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(502)
  })

  it('returns 502 when the webhook call throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(502)
  })

  it('rate-limits the same IP after 5 tries in the window', async () => {
    mockWebhook(200, { ok: true })

    for (let i = 0; i < 5; i++) {
      expect((await POST(makeRequest(VALID_BODY, '198.51.100.1'))).status).toBe(200)
    }

    expect((await POST(makeRequest(VALID_BODY, '198.51.100.1'))).status).toBe(429)
    expect((await POST(makeRequest(VALID_BODY, '198.51.100.2'))).status).toBe(200)
  })
})
