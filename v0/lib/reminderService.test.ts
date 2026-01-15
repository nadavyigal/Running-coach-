import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  }
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

vi.mock('./analytics', () => ({
  trackReminderEvent: vi.fn()
}))

vi.mock('./dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(() => Promise.resolve({ id: 1 })),
    updateReminderSettings: vi.fn(() => Promise.resolve()),
    getReminderSettings: vi.fn(() => Promise.resolve({ enabled: false, time: '10:00' }))
  }
}))

vi.mock('./db', () => {
  const mockDb = {
    users: {
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null))
        }))
      })),
      add: vi.fn(() => Promise.resolve(1)),
      update: vi.fn(() => Promise.resolve(1))
    }
  };

  return {
    db: mockDb,
    isDatabaseAvailable: vi.fn(() => Promise.resolve(true)),
    safeDbOperation: vi.fn((fn) => fn()),
    getDatabase: vi.fn(() => mockDb),
    resetDatabaseInstance: vi.fn()
  };
})

import { reminderService } from './reminderService'
import { toast } from '@/hooks/use-toast'
import { trackReminderEvent } from './analytics'

const mockedToast = toast as unknown as ReturnType<typeof vi.fn>
const mockTrackReminderEvent = trackReminderEvent as unknown as ReturnType<typeof vi.fn>

describe('reminderService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockedToast.mockClear()
    mockTrackReminderEvent.mockClear()
  })

  afterEach(() => {
    reminderService.clear()
    vi.useRealTimers()
  })

  it('schedules and triggers reminder', async () => {
    const now = new Date()
    const inOneMin = new Date(now.getTime() + 60000)
    const time = `${inOneMin.getHours().toString().padStart(2,'0')}:${inOneMin.getMinutes().toString().padStart(2,'0')}`

    await reminderService.setReminder(time)
    expect(mockTrackReminderEvent).toHaveBeenCalledWith('reminder_set', { time })

    vi.advanceTimersByTime(60000)
    await vi.runAllTimersAsync()

    expect(mockedToast).toHaveBeenCalled()
    expect(mockTrackReminderEvent).toHaveBeenCalledWith('reminder_triggered')
  })

  it('snoozes reminder', async () => {
    await reminderService.setReminder('00:00')
    vi.clearAllMocks()
    mockTrackReminderEvent.mockClear()
    mockedToast.mockClear()
    
    await reminderService.snooze(5)
    expect(mockTrackReminderEvent).toHaveBeenCalledWith('reminder_snoozed', { minutes: 5 })
    
    vi.advanceTimersByTime(5 * 60000)
    await vi.runAllTimersAsync()
    expect(mockedToast).toHaveBeenCalled()
  })

  it('disables reminder', async () => {
    await reminderService.setReminder('00:00')
    vi.clearAllMocks()
    mockTrackReminderEvent.mockClear()
    mockedToast.mockClear()
    
    await reminderService.disableReminder()
    expect(mockTrackReminderEvent).toHaveBeenCalledWith('reminder_disabled')
    
    vi.advanceTimersByTime(24 * 60 * 60000)
    await vi.runAllTimersAsync()
    expect(mockedToast).not.toHaveBeenCalled()
  })
})
