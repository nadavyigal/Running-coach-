'use client';

import { useState, useEffect } from 'react'
import { reminderService } from '@/lib/reminderService'
import { dbUtils } from '@/lib/dbUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ReminderSettings() {
  const [time, setTime] = useState('')
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      const user = await dbUtils.getCurrentUser()
      if (user && user.reminderTime) {
        setTime(user.reminderTime)
        setEnabled(user.reminderEnabled ?? false)
      }
    }
    fetchSettings()
  }, [])

  const handleSetReminder = async () => {
    await reminderService.setReminder(time)
    setEnabled(true)
  }

  const handleDisableReminder = async () => {
    await reminderService.disableReminder()
    setEnabled(false)
  }

  return (
    <div className="p-4 border-t">
      <h3 className="text-lg font-semibold">Reminders</h3>
      <div className="flex items-center gap-2 mt-2">
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Button onClick={handleSetReminder} disabled={!time}>Set</Button>
        <Button onClick={handleDisableReminder} disabled={!enabled} variant="destructive">Disable</Button>
      </div>
    </div>
  )
}
