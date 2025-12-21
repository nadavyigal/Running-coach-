import { dbUtils } from '@/lib/dbUtils'
import { toast } from '@/hooks/use-toast'
import { trackReminderEvent } from './analytics'

export interface ReminderSettings {
  time: string
  enabled: boolean
  snoozedUntil?: Date | null
}

class ReminderService {
  private timeout: ReturnType<typeof setTimeout> | null = null

  async init() {
    const user = await dbUtils.getCurrentUser()
    const userId = user?.id
    if (!user || typeof userId !== 'number') return
    if (user.reminderEnabled && user.reminderTime) {
      if (user.reminderSnoozedUntil && new Date(user.reminderSnoozedUntil) > new Date()) {
        const delay = new Date(user.reminderSnoozedUntil).getTime() - Date.now()
        this.timeout = setTimeout(() => this.trigger(userId), delay)
      } else {
        this.scheduleNext(userId, user.reminderTime)
      }
    }
  }

  clear() {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  private scheduleNext(userId: number, time: string) {
    this.clear()
    const parts = time.split(':')
    const hour = Number(parts.at(0))
    const minute = Number(parts.at(1))
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return

    const now = new Date()
    const next = new Date()
    next.setHours(hour, minute, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    const delay = next.getTime() - now.getTime()
    this.timeout = setTimeout(() => this.trigger(userId), delay)
  }

  private async trigger(userId: number) {
    toast({ 
      title: 'Time to run!', 
      description: "Let's keep the habit going.",
    })
    trackReminderEvent('reminder_triggered')
    await dbUtils.updateReminderSettings(userId, { reminderSnoozedUntil: null })
    const settings = await dbUtils.getReminderSettings(userId)
    if (settings.enabled && settings.time) this.scheduleNext(userId, settings.time)
  }

  async setReminder(time: string) {
    const user = await dbUtils.getCurrentUser()
    const userId = user?.id
    if (typeof userId !== 'number') return
    await dbUtils.updateReminderSettings(userId, { reminderTime: time, reminderEnabled: true, reminderSnoozedUntil: null })
    trackReminderEvent('reminder_set', { time })
    this.scheduleNext(userId, time)
  }

  async disableReminder() {
    const user = await dbUtils.getCurrentUser()
    const userId = user?.id
    if (typeof userId !== 'number') return
    this.clear()
    await dbUtils.updateReminderSettings(userId, { reminderEnabled: false, reminderSnoozedUntil: null })
    trackReminderEvent('reminder_disabled')
  }

  async snooze(minutes: number) {
    const user = await dbUtils.getCurrentUser()
    const userId = user?.id
    if (typeof userId !== 'number') return
    const until = new Date(Date.now() + minutes * 60000)
    this.clear()
    await dbUtils.updateReminderSettings(userId, { reminderSnoozedUntil: until })
    trackReminderEvent('reminder_snoozed', { minutes })
    this.timeout = setTimeout(() => this.trigger(userId), minutes * 60000)
  }
}

export const reminderService = new ReminderService()
