import { NextResponse } from 'next/server'
import { z } from 'zod'

import { rateLimiter, securityConfig } from '@/lib/security.config'

// Beta registrations from /beta land as rows in the founder's Google Sheet
// through a Google Apps Script web app. Setup: docs/beta/README.md.

const RATE_LIMIT = { ...securityConfig.rateLimit, windowMs: 10 * 60 * 1000, max: 5 }
const WEBHOOK_TIMEOUT_MS = 8000

const GOAL_LABELS = {
  race: 'Race or target date',
  return: 'Get back to running',
  consistency: 'Run more often',
  other: 'Other',
} as const

const yesNo = z.enum(['yes', 'no'])

function isLinkedinUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return /^https?:$/.test(url.protocol) && (host === 'linkedin.com' || host.endsWith('.linkedin.com'))
  } catch {
    return false
  }
}

const registrationSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  linkedinUrl: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === '' || isLinkedinUrl(value), { message: 'Use a linkedin.com profile link' })
    .optional(),
  country: z.string().trim().min(2).max(80),
  hasIphone: yesNo,
  goal: z.enum(['race', 'return', 'consistency', 'other']),
  raceDate: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: 'Use a valid date' })
    .optional(),
  returningAfterBreak: yesNo,
  runsPerWeekNow: z.enum(['0', '1-2', '3-4', '5+']),
  source: z.string().optional(),
  utmCampaign: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please agree to continue' }) }),
})

type BetaRegistration = z.infer<typeof registrationSchema>

function cleanTag(value: string | undefined, fallback: string, maxLength: number): string {
  const cleaned = (value ?? '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, maxLength)
  return cleaned || fallback
}

function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// Keys match row 1 of the "RunSmart Beta Registrations" sheet.
function toSheetRow(data: BetaRegistration, submittedAt: Date) {
  return {
    submitted_at: submittedAt.toISOString(),
    full_name: data.fullName,
    email_for_app: data.email.toLowerCase(),
    linkedin_url: data.linkedinUrl ?? '',
    country: data.country,
    has_iphone: data.hasIphone,
    goal: GOAL_LABELS[data.goal],
    race_date: data.raceDate ?? '',
    returning_after_break: data.returningAfterBreak,
    runs_per_week_now: data.runsPerWeekNow,
    source: cleanTag(data.source, 'direct', 40),
    utm_campaign: cleanTag(data.utmCampaign, '', 80),
    consent: 'yes',
  }
}

export async function POST(request: Request) {
  const rateLimit = await rateLimiter.check(`beta-register:${getClientIP(request)}`, RATE_LIMIT)
  if (!rateLimit.success) {
    return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 })
  }

  // Honeypot: real visitors never see the hpField input. Answer like a success so bots move on.
  const honeypot = (body as Record<string, unknown>).hpField
  if (typeof honeypot === 'string' && honeypot.trim()) {
    return NextResponse.json({ success: true })
  }

  const parsed = registrationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check the form and try again.', fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const webhookUrl = process.env.BETA_SHEET_WEBHOOK_URL?.trim()
  const webhookSecret = process.env.BETA_SHEET_WEBHOOK_SECRET?.trim()
  if (!webhookUrl || !webhookSecret) {
    console.error('[beta/register] BETA_SHEET_WEBHOOK_URL or BETA_SHEET_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Registration is not open yet. Please try again later.' }, { status: 503 })
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: webhookSecret, row: toSheetRow(parsed.data, new Date()) }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
    // Apps Script answers 200 with an HTML page when the deployment is wrong, so require { ok: true }.
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!response.ok || result?.ok !== true) {
      console.error('[beta/register] sheet webhook rejected the row', response.status, result?.error ?? 'no json')
      return NextResponse.json({ error: 'We could not save your registration. Please try again.' }, { status: 502 })
    }
  } catch (error) {
    console.error('[beta/register] sheet webhook failed', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: 'We could not save your registration. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
