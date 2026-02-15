/**
 * Email Sequence Automation for RunSmart
 *
 * Manages automated email campaigns for user activation, engagement, and retention.
 * Sequences are triggered based on user behavior and time-based rules.
 *
 * @see V0/app/api/cron/email-sequences/route.ts for scheduled execution
 */

import { sendEmail } from '../email'
import { db } from '../db'
import { logger } from '../logger'

// ============================================================================
// SEQUENCE DEFINITIONS
// ============================================================================

/**
 * Email sequence types
 */
export enum EmailSequence {
  WELCOME = 'welcome',
  ONBOARDING = 'onboarding',
  FIRST_RUN_REMINDER = 'first_run_reminder',
  PLAN_ACTIVATION = 'plan_activation',
  RE_ENGAGEMENT = 're_engagement',
  MILESTONE = 'milestone',
  WEEKLY_SUMMARY = 'weekly_summary',
}

/**
 * Email sequence configuration
 */
interface SequenceConfig {
  id: EmailSequence
  name: string
  triggerDelay: number // Days after signup or event
  condition: (user: any) => Promise<boolean>
  generateEmail: (user: any) => Promise<{ subject: string; html: string; text?: string }>
}

/**
 * Calculate days since a date
 */
function daysSince(date: Date): number {
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

// ============================================================================
// EMAIL SEQUENCE CONFIGURATIONS
// ============================================================================

/**
 * D3: First Run Reminder
 * Sent 3 days after signup if user hasn't recorded their first run
 */
const firstRunReminderSequence: SequenceConfig = {
  id: EmailSequence.FIRST_RUN_REMINDER,
  name: 'First Run Reminder (D3)',
  triggerDelay: 3,
  condition: async (user) => {
    // Only send if user hasn't recorded any runs
    const runCount = await db.runs.where('userId').equals(user.id).count()
    return runCount === 0
  },
  generateEmail: async (user) => {
    const displayName = user.name || 'Runner'

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🏃 Ready for Your First Run?</h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 22px;">Hi ${displayName},</h2>

                      <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        You joined RunSmart 3 days ago, but we noticed you haven't recorded your first run yet. Let's get you started!
                      </p>

                      <div style="background-color: #f0fdf4; padding: 20px; border-left: 4px solid #10b981; margin: 24px 0;">
                        <p style="margin: 0 0 12px; color: #065f46; font-size: 16px; font-weight: 600;">
                          💡 Quick Start Guide
                        </p>
                        <ol style="margin: 0; padding-left: 20px; color: #065f46; font-size: 15px; line-height: 1.8;">
                          <li>Open the RunSmart app</li>
                          <li>Tap the Record button (bottom center)</li>
                          <li>Start your run - we'll track everything!</li>
                          <li>Save your run when you're done</li>
                        </ol>
                      </div>

                      <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        <strong>Don't worry about distance or pace</strong> - even a short 5-minute jog counts! The hardest part is just getting started.
                      </p>

                      <div style="text-align: center; margin: 32px 0;">
                        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'}/record" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                          Record Your First Run
                        </a>
                      </div>

                      <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center; font-style: italic;">
                        "The secret of getting ahead is getting started." – Mark Twain
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 20px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="margin: 0; color: #888888; font-size: 14px;">
                        RunSmart AI Running Coach<br>
                        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'}" style="color: #10b981; text-decoration: none;">runsmart.app</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    const text = `
Hi ${displayName},

You joined RunSmart 3 days ago, but we noticed you haven't recorded your first run yet. Let's get you started!

💡 Quick Start Guide:
1. Open the RunSmart app
2. Tap the Record button (bottom center)
3. Start your run - we'll track everything!
4. Save your run when you're done

Don't worry about distance or pace - even a short 5-minute jog counts! The hardest part is just getting started.

Record Your First Run: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'}/record

"The secret of getting ahead is getting started." – Mark Twain

RunSmart AI Running Coach
runsmart.app
    `

    return {
      subject: "Ready for your first run? Let's do this! 🏃",
      html,
      text,
    }
  },
}

/**
 * D7: Plan Reminder
 * Sent 7 days after signup if user has generated a plan but hasn't started following it
 */
const planActivationSequence: SequenceConfig = {
  id: EmailSequence.PLAN_ACTIVATION,
  name: 'Plan Activation Reminder (D7)',
  triggerDelay: 7,
  condition: async (user) => {
    const plan = await db.plans.where('userId').equals(user.id).first()
    if (!plan) return false

    // Check if they've completed any workouts from their plan
    const workoutCount = await db.runs
      .where('userId')
      .equals(user.id)
      .filter((run) => run.planId === plan.id)
      .count()

    return workoutCount === 0
  },
  generateEmail: async (user) => {
    const displayName = user.name || 'Runner'
    const plan = await db.plans.where('userId').equals(user.id).first()

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px;">
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 22px;">Hi ${displayName},</h2>
                      <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        Your personalized training plan is ready and waiting! It's been designed specifically for your ${user.goal} goal.
                      </p>
                      <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        Let's make this week count - your plan includes ${plan?.workouts?.length || 3} workouts that will help you build momentum.
                      </p>
                      <div style="text-align: center; margin: 32px 0;">
                        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'}/plan" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                          View My Plan
                        </a>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    return {
      subject: `${displayName}, your personalized training plan is waiting! 📋`,
      html,
    }
  },
}

/**
 * D30: Re-engagement
 * Sent 30 days after last activity if user has gone inactive
 */
const reEngagementSequence: SequenceConfig = {
  id: EmailSequence.RE_ENGAGEMENT,
  name: 'Re-engagement (D30)',
  triggerDelay: 30,
  condition: async (user) => {
    const lastRun = await db.runs
      .where('userId')
      .equals(user.id)
      .reverse()
      .sortBy('date')
      .then((runs) => runs[0])

    if (!lastRun) return true // Never ran

    const daysSinceLastRun = daysSince(lastRun.date)
    return daysSinceLastRun >= 30
  },
  generateEmail: async (user) => {
    const displayName = user.name || 'Runner'

    return {
      subject: `We miss you, ${displayName}! Let's get back on track 💪`,
      html: `
        <p>Hi ${displayName},</p>
        <p>It's been a while since your last run. We understand life gets busy!</p>
        <p>Your RunSmart plan is still here waiting for you. Even a short run today can help you rebuild momentum.</p>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'}">Let's Get Running Again</a>
      `,
    }
  },
}

/**
 * All configured sequences
 */
const ALL_SEQUENCES: SequenceConfig[] = [
  firstRunReminderSequence,
  planActivationSequence,
  reEngagementSequence,
]

// ============================================================================
// SEQUENCE EXECUTION
// ============================================================================

/**
 * Check if a user should receive a specific email sequence
 */
export async function shouldSendSequenceEmail(
  userId: number,
  sequence: EmailSequence
): Promise<boolean> {
  const user = await db.users.get(userId)
  if (!user || !user.email) return false

  const sequenceConfig = ALL_SEQUENCES.find((s) => s.id === sequence)
  if (!sequenceConfig) return false

  const daysSinceSignup = daysSince(user.createdAt)

  // Check if it's time to send this sequence
  if (daysSinceSignup < sequenceConfig.triggerDelay) return false

  // Check sequence-specific conditions
  const meetsCondition = await sequenceConfig.condition(user)
  if (!meetsCondition) return false

  // TODO: Check if email was already sent (requires email_sends table)
  // For now, we'll assume it hasn't been sent

  return true
}

/**
 * Send a sequence email to a user
 */
export async function sendSequenceEmail(
  userId: number,
  sequence: EmailSequence
): Promise<void> {
  const user = await db.users.get(userId)
  if (!user || !user.email) {
    logger.warn(`Cannot send email - user ${userId} not found or missing email`)
    return
  }

  const sequenceConfig = ALL_SEQUENCES.find((s) => s.id === sequence)
  if (!sequenceConfig) {
    logger.error(`Unknown email sequence: ${sequence}`)
    return
  }

  try {
    const { subject, html, text } = await sequenceConfig.generateEmail(user)

    await sendEmail({
      to: user.email,
      subject,
      html,
      text,
    })

    logger.info(
      `Sent ${sequence} email to user ${userId} (${user.email})`
    )

    // TODO: Log email send to database for tracking
    // await db.emailSends.add({
    //   userId,
    //   sequenceId: sequence,
    //   sentAt: new Date(),
    // })
  } catch (error) {
    logger.error(`Failed to send ${sequence} email to user ${userId}:`, error)
    throw error
  }
}

/**
 * Process all email sequences for all users
 * This should be called by a cron job (e.g., daily)
 */
export async function processEmailSequences(): Promise<{
  processed: number
  sent: number
  errors: number
}> {
  const stats = { processed: 0, sent: 0, errors: 0 }

  try {
    const users = await db.users.toArray()
    logger.info(`Processing email sequences for ${users.length} users`)

    for (const user of users) {
      if (!user.id || !user.email) continue

      stats.processed++

      for (const sequence of ALL_SEQUENCES) {
        try {
          const shouldSend = await shouldSendSequenceEmail(user.id, sequence.id)

          if (shouldSend) {
            await sendSequenceEmail(user.id, sequence.id)
            stats.sent++
          }
        } catch (error) {
          logger.error(
            `Error processing ${sequence.id} for user ${user.id}:`,
            error
          )
          stats.errors++
        }
      }
    }

    logger.info('Email sequence processing complete:', stats)
    return stats
  } catch (error) {
    logger.error('Fatal error in email sequence processing:', error)
    throw error
  }
}

// ============================================================================
// MANUAL TRIGGERS
// ============================================================================

/**
 * Manually trigger a specific sequence for a user (for testing)
 */
export async function triggerSequenceManual(
  userId: number,
  sequence: EmailSequence
): Promise<void> {
  await sendSequenceEmail(userId, sequence)
}
