import { NextResponse } from 'next/server'
import { z } from 'zod'

import { withApiSecurity, type ApiRequest } from '@/lib/security.middleware'
import { createBetaSignup } from '@/lib/server/betaSignupRepository'
import { sendBetaWaitlistEmail } from '@/lib/email'

const betaSignupRequestSchema = z
  .object({
    email: z.string().trim().email(),
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    goals: z.array(z.enum(['habit', 'race', 'fitness', 'injury_prevention'])).min(1),
    hearAboutUs: z
      .enum(['friend', 'instagram', 'twitter', 'reddit', 'product_hunt', 'search', 'blog', 'whatsapp', 'other'])
      .optional(),
    hearAboutUsOther: z.string().trim().optional(),
    agreedToTerms: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.agreedToTerms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agreedToTerms'],
        message: 'You must agree to the Privacy Policy and Terms of Service',
      })
    }

    if (value.hearAboutUs === 'other' && !value.hearAboutUsOther) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hearAboutUsOther'],
        message: 'Please specify how you heard about us',
      })
    }
  })

async function betaSignupHandler(req: ApiRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const json = await req.json().catch(() => null)
  const parsed = betaSignupRequestSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the form and try again.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { email, experienceLevel, goals, hearAboutUs, hearAboutUsOther } = parsed.data

  const normalizedEmail = email.trim().toLowerCase()
  const goalsString = JSON.stringify(goals)

  const hearAboutUsValue =
    hearAboutUs === 'other'
      ? `other:${(hearAboutUsOther ?? '').trim()}`
      : hearAboutUs
        ? hearAboutUs
        : 'unknown'

  try {
    // IMPORTANT: Beta signups automatically create full user accounts
    const result = await createBetaSignup({
      email: normalizedEmail,
      experienceLevel,
      goals: goalsString,
      hearAboutUs: hearAboutUsValue,
      createUserAccount: true, // Create full auth user + profile
    })

    let emailSent = false
    if (result.created) {
      try {
        await sendBetaWaitlistEmail(normalizedEmail)
        emailSent = true
      } catch (emailError) {
        console.error('Failed to send beta waitlist email:', emailError)
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        created: result.created, 
        storage: result.storage, 
        emailSent,
        userId: result.userId,
        profileId: result.profileId,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Unable to save your signup right now. Please try again soon.'
        : error instanceof Error
          ? error.message
          : 'Failed to save signup'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export const POST = withApiSecurity(betaSignupHandler)
