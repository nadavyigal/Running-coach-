/**
 * Email Sequence Cron Job: DISABLED (2026-10-20)
 *
 * The daily schedule is removed from vercel.json and both handlers return 503
 * without doing any work. processEmailSequences() in lib/email/sequences.ts
 * reads the browser-only Dexie store, so every server run failed with
 * "Database not available".
 *
 * The server-side rewrite is parked in PR #140. Before it ships it needs:
 * fail-closed cron auth, RLS/grants on email_sends, idempotent delivery, and an
 * eligibility upper bound so existing users are not emailed their whole history.
 */

import { NextResponse } from 'next/server'

function disabledResponse() {
  return NextResponse.json(
    {
      success: false,
      disabled: true,
      reason: 'email_sequences_disabled',
      message: 'Email sequences are disabled until server-side processing ships (PR #140).',
      timestamp: new Date().toISOString(),
    },
    { status: 503 }
  )
}

export async function GET() {
  return disabledResponse()
}

export async function POST() {
  return disabledResponse()
}
