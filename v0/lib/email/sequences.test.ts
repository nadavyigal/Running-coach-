import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EmailSequence,
  daysSince,
  isWithinSequenceTimingWindow,
  processEmailSequences,
  shouldSendSequenceEmail,
} from './sequences'

const storeMocks = vi.hoisted(() => ({
  assertEmailSequenceStoreConfigured: vi.fn(),
  listEligibleUsers: vi.fn(),
  countRuns: vi.fn(),
  getActivePlan: vi.fn(),
  countRunsForPlan: vi.fn(),
  getLastRunCompletedAt: vi.fn(),
  wasSequenceSent: vi.fn(),
  recordSequenceSent: vi.fn(),
}))

const sendEmailMock = vi.hoisted(() => vi.fn())

vi.mock('../server/email-sequence-store', () => storeMocks)
vi.mock('../email', () => ({
  sendEmail: sendEmailMock,
}))
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function makeUser(createdAt: string) {
  return {
    profileId: 'profile-1',
    email: 'runner@example.com',
    name: 'Runner',
    goal: 'habit',
    createdAt: new Date(createdAt),
  }
}

describe('email sequences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00.000Z'))

    storeMocks.assertEmailSequenceStoreConfigured.mockImplementation(() => undefined)
    storeMocks.listEligibleUsers.mockResolvedValue([makeUser('2026-10-03T00:00:00.000Z')])
    storeMocks.countRuns.mockResolvedValue(0)
    storeMocks.getActivePlan.mockResolvedValue(null)
    storeMocks.countRunsForPlan.mockResolvedValue(0)
    storeMocks.getLastRunCompletedAt.mockResolvedValue(null)
    storeMocks.wasSequenceSent.mockResolvedValue(false)
    storeMocks.recordSequenceSent.mockResolvedValue(undefined)
    sendEmailMock.mockResolvedValue({ success: true, data: { id: 'email-1' } })
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.EMAIL_SEQUENCE_MAX_SENDS_PER_RUN
  })

  it('does not blast historical users outside lifecycle windows', async () => {
    storeMocks.listEligibleUsers.mockResolvedValue([makeUser('2026-06-01T00:00:00.000Z')])

    const stats = await processEmailSequences()

    expect(stats).toMatchObject({ processed: 1, sent: 0, errors: 0, capped: false })
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(storeMocks.recordSequenceSent).not.toHaveBeenCalled()
  })

  it('sends only sequences inside their signup-age window', async () => {
    const stats = await processEmailSequences()

    expect(daysSince(new Date('2026-10-03T00:00:00.000Z'))).toBe(3)
    expect(stats).toMatchObject({ processed: 1, sent: 1, errors: 0, capped: false })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      to: 'runner@example.com',
      subject: expect.stringContaining('first run'),
    })
    expect(storeMocks.recordSequenceSent).toHaveBeenCalledWith(
      'profile-1',
      EmailSequence.FIRST_RUN_REMINDER
    )
  })

  it('dry run reports would-send recipients without sending', async () => {
    const stats = await processEmailSequences({ dryRun: true })

    expect(stats).toMatchObject({
      processed: 1,
      sent: 0,
      errors: 0,
      dryRun: true,
      capped: false,
      wouldSend: [
        {
          profileId: 'profile-1',
          email: 'runner@example.com',
          sequence: EmailSequence.FIRST_RUN_REMINDER,
        },
      ],
    })
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(storeMocks.recordSequenceSent).not.toHaveBeenCalled()
  })

  it('skips sequences that were already sent', async () => {
    storeMocks.wasSequenceSent.mockImplementation(async (_profileId, sequenceId) => {
      return sequenceId === EmailSequence.FIRST_RUN_REMINDER
    })

    const shouldSend = await shouldSendSequenceEmail(
      makeUser('2026-10-03T00:00:00.000Z'),
      EmailSequence.FIRST_RUN_REMINDER
    )

    expect(shouldSend).toBe(false)
    expect(storeMocks.countRuns).not.toHaveBeenCalled()
  })

  it('does not send when the signup is too recent', async () => {
    const shouldSend = await shouldSendSequenceEmail(
      makeUser('2026-10-05T00:00:00.000Z'),
      EmailSequence.FIRST_RUN_REMINDER
    )

    expect(shouldSend).toBe(false)
  })

  it('ignores never-active users for re-engagement', async () => {
    const inactiveUser = makeUser('2026-06-01T00:00:00.000Z')

    const shouldSend = await shouldSendSequenceEmail(
      inactiveUser,
      EmailSequence.RE_ENGAGEMENT
    )

    expect(shouldSend).toBe(false)
  })

  it('skips re-engagement when inactivity is outside the send window', async () => {
    const inactiveUser = makeUser('2026-06-01T00:00:00.000Z')
    storeMocks.getLastRunCompletedAt.mockResolvedValue(new Date('2026-09-01T00:00:00.000Z'))

    const shouldSend = await shouldSendSequenceEmail(
      inactiveUser,
      EmailSequence.RE_ENGAGEMENT
    )

    expect(shouldSend).toBe(false)
  })

  it('records per-sequence errors without aborting the whole cron run', async () => {
    sendEmailMock.mockRejectedValue(new Error('Resend unavailable'))

    const stats = await processEmailSequences()

    expect(stats.processed).toBe(1)
    expect(stats.errors).toBe(1)
    expect(stats.sent).toBe(0)
    expect(storeMocks.recordSequenceSent).not.toHaveBeenCalled()
  })

  it('caps live sends per run as a safety net', async () => {
    storeMocks.listEligibleUsers.mockResolvedValue([
      makeUser('2026-10-03T00:00:00.000Z'),
      makeUser('2026-10-03T00:00:00.000Z'),
    ])

    const stats = await processEmailSequences({ maxSendsPerRun: 1 })

    expect(stats.sent).toBe(1)
    expect(stats.capped).toBe(true)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })
})

describe('isWithinSequenceTimingWindow', () => {
  it('accepts signup-age windows inclusively', () => {
    expect(
      isWithinSequenceTimingWindow(
        { kind: 'signup_age', minDays: 3, maxDays: 5 },
        3,
        null
      )
    ).toBe(true)
    expect(
      isWithinSequenceTimingWindow(
        { kind: 'signup_age', minDays: 3, maxDays: 5 },
        32,
        null
      )
    ).toBe(false)
  })

  it('requires prior activity for inactivity windows', () => {
    expect(
      isWithinSequenceTimingWindow(
        { kind: 'inactivity', minDays: 30, maxDays: 32 },
        100,
        null
      )
    ).toBe(false)
    expect(
      isWithinSequenceTimingWindow(
        { kind: 'inactivity', minDays: 30, maxDays: 32 },
        100,
        31
      )
    ).toBe(true)
  })
})
