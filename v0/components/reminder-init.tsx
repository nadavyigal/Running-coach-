'use client';

import { reminderService } from '@/lib/reminderService'
import { useEffect } from 'react'

export function ReminderInit() {
  useEffect(() => {
    reminderService.init()
  }, [])

  return null
}