import { dbUtils } from './dbUtils'
import { toast } from '@/hooks/use-toast'
import posthog from 'posthog-js'
import { trackReminderEvent, trackReminderClicked } from './analytics'

export interface ReminderSettings {
  time: string
  enabled: boolean
  snoozedUntil?: Date | null
}

class ReminderService {
  private timeout: ReturnType<typeof setTimeout> | null = null

  async init() {
    const user = await dbUtils.getCurrentUser()
    if (!user) return
    if (user.reminderEnabled && user.reminderTime) {
      if (user.reminderSnoozedUntil && new Date(user.reminderSnoozedUntil) > new Date()) {
        const delay = new Date(user.reminderSnoozedUntil).getTime() - Date.now()
        this.timeout = setTimeout(() => this.trigger(user.id!), delay)
      } else {
        this.scheduleNext(user.id!, user.reminderTime)
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
    const [h, m] = time.split(':').map(Number)
    const now = new Date()
    const next = new Date()
    next.setHours(h, m, 0, 0)
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
    if (!user) return
    await dbUtils.updateReminderSettings(user.id!, { reminderTime: time, reminderEnabled: true, reminderSnoozedUntil: null })
    trackReminderEvent('reminder_set', { time })
    this.scheduleNext(user.id!, time)
  }

  async disableReminder() {
    const user = await dbUtils.getCurrentUser()
    if (!user) return
    this.clear()
    await dbUtils.updateReminderSettings(user.id!, { reminderEnabled: false, reminderSnoozedUntil: null })
    trackReminderEvent('reminder_disabled')
  }

  async snooze(minutes: number) {
    const user = await dbUtils.getCurrentUser()
    if (!user) return
    const until = new Date(Date.now() + minutes * 60000)
    this.clear()
    await dbUtils.updateReminderSettings(user.id!, { reminderSnoozedUntil: until })
    trackReminderEvent('reminder_snoozed', { minutes })
    this.timeout = setTimeout(() => this.trigger(user.id!), minutes * 60000)
  }
}

export const reminderService = new ReminderService()
