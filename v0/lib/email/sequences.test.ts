import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailSequence, processEmailSequences, shouldSendSequenceEmail } from './sequences'

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

const baseUser = {
  profileId: 'profile-1',
  email: 'runner@example.com',
  name: 'Runner',
  goal: 'habit',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
}

describe('email sequences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-03T00:00:00.000Z'))

    storeMocks.assertEmailSequenceStoreConfigured.mockImplementation(() => undefined)
    storeMocks.listEligibleUsers.mockResolvedValue([baseUser])
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
  })

  it('sends lifecycle emails when signup is old enough and no runs exist', async () => {
    const stats = await processEmailSequences()

    expect(stats).toEqual({ processed: 1, sent: 2, errors: 0 })
    expect(sendEmailMock).toHaveBeenCalledTimes(2)
    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      to: 'runner@example.com',
      subject: expect.stringContaining('first run'),
    })
    expect(storeMocks.recordSequenceSent).toHaveBeenCalledWith(
      'profile-1',
      EmailSequence.FIRST_RUN_REMINDER
    )
    expect(storeMocks.recordSequenceSent).toHaveBeenCalledWith(
      'profile-1',
      EmailSequence.RE_ENGAGEMENT
    )
  })

  it('skips sequences that were already sent', async () => {
    storeMocks.wasSequenceSent.mockImplementation(async (_profileId, sequenceId) => {
      return sequenceId === EmailSequence.FIRST_RUN_REMINDER
    })

    const shouldSend = await shouldSendSequenceEmail(baseUser, EmailSequence.FIRST_RUN_REMINDER)

    expect(shouldSend).toBe(false)
    expect(storeMocks.countRuns).not.toHaveBeenCalled()
  })

  it('does not send when the signup is too recent', async () => {
    const recentUser = {
      ...baseUser,
      createdAt: new Date('2026-10-02T00:00:00.000Z'),
    }

    const shouldSend = await shouldSendSequenceEmail(
      recentUser,
      EmailSequence.FIRST_RUN_REMINDER
    )

    expect(shouldSend).toBe(false)
  })

  it('records per-sequence errors without aborting the whole cron run', async () => {
    sendEmailMock.mockRejectedValue(new Error('Resend unavailable'))

    const stats = await processEmailSequences()

    expect(stats.processed).toBe(1)
    expect(stats.errors).toBe(2)
    expect(stats.sent).toBe(0)
    expect(storeMocks.recordSequenceSent).not.toHaveBeenCalled()
  })
})
