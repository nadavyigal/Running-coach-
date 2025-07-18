import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { reminderService } from './reminderService'
import { db, dbUtils } from './db'
import posthog from 'posthog-js'
import { toast } from '@/hooks/use-toast'

vi.mock('posthog-js', () => {
  const mockPosthog = {
    capture: vi.fn(),
  };
  return {
    default: mockPosthog,
  };
});
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

const mockedToast = toast as unknown as ReturnType<typeof vi.fn>
const capture = vi.fn()

describe('reminderService', () => {
  vi.setConfig({ testTimeout: 60000 });
  let userId: number

  beforeEach(async () => {
    vi.useFakeTimers()
    capture.mockClear()
    mockedToast.mockClear()
    await db.users.clear()
    userId = await dbUtils.createUser({
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: true },
      onboardingComplete: true
    })
  })

  afterEach(async () => {
    reminderService.clear()
    vi.useRealTimers()
    await db.users.clear()
  })

  it('schedules and triggers reminder', async () => {
    const now = new Date()
    const inOneMin = new Date(now.getTime() + 60000)
    const time = `${inOneMin.getHours().toString().padStart(2,'0')}:${inOneMin.getMinutes().toString().padStart(2,'0')}`

    await reminderService.setReminder(time)
    expect(posthog.capture).toHaveBeenCalledWith('reminder_set', { time })

    vi.advanceTimersByTime(60000)
    await vi.runAllTimers()

    expect(mockedToast).toHaveBeenCalled()
    expect(posthog.capture).toHaveBeenCalledWith('reminder_triggered')
  })

  it('snoozes reminder', async () => {
    await reminderService.setReminder('00:00')
    capture.mockClear()
    mockedToast.mockClear()
    await reminderService.snooze(5)
    expect(posthog.capture).toHaveBeenCalledWith('reminder_snoozed', { minutes: 5 })
    vi.advanceTimersByTime(5 * 60000)
    await vi.runAllTimers()
    expect(mockedToast).toHaveBeenCalled()
  })

  it('disables reminder', async () => {
    await reminderService.setReminder('00:00')
    capture.mockClear()
    mockedToast.mockClear()
    await reminderService.disableReminder()
    expect(posthog.capture).toHaveBeenCalledWith('reminder_disabled')
    vi.advanceTimersByTime(24 * 60 * 60000)
    await vi.runAllTimers()
    expect(mockedToast).not.toHaveBeenCalled()
  })
})
