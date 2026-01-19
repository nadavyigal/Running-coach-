'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Cloud, Shield, Smartphone } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { AuthModal } from './auth-modal'
import { logger } from '@/lib/logger'

export function WelcomeModal() {
  const [showWelcome, setShowWelcome] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    // Only show welcome modal to unauthenticated users
    if (user) {
      return
    }

    // Check if user has seen welcome modal
    const hasSeenWelcome = localStorage.getItem('has_seen_welcome_modal')
    const hasDismissedRecently = localStorage.getItem('welcome_dismissed_at')

    // Don't show if dismissed in last 7 days
    if (hasDismissedRecently) {
      const dismissedAt = new Date(hasDismissedRecently)
      const daysSinceDismissal = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceDismissal < 7) {
        return
      }
    }

    // Check if user has any local data (runs, goals, etc)
    const hasDeviceId = localStorage.getItem('device_id')

    // Show welcome modal if user has data but no account
    if (!hasSeenWelcome && hasDeviceId) {
      // Delay showing modal slightly for better UX
      const timer = setTimeout(() => {
        setShowWelcome(true)
        logger.info('[WelcomeModal] Showing welcome modal to existing user')
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [user])

  const handleCreateAccount = () => {
    setShowWelcome(false)
    setShowAuth(true)
    localStorage.setItem('has_seen_welcome_modal', 'true')
    logger.info('[WelcomeModal] User clicked Create Account')
  }

  const handleMaybeLater = () => {
    setShowWelcome(false)
    localStorage.setItem('has_seen_welcome_modal', 'true')
    localStorage.setItem('welcome_dismissed_at', new Date().toISOString())
    logger.info('[WelcomeModal] User dismissed welcome modal')
  }

  const handleAuthModalClose = () => {
    setShowAuth(false)
  }

  return (
    <>
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Never Lose Your Data</DialogTitle>
            <DialogDescription className="text-base">
              Create an account to automatically backup your runs and training plans.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Cloud className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Automatic Cloud Backup</h4>
                <p className="text-sm text-muted-foreground">
                  Your runs, goals, and progress are safely stored in the cloud
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Access Anywhere</h4>
                <p className="text-sm text-muted-foreground">
                  Switch devices without losing your training history
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Secure & Private</h4>
                <p className="text-sm text-muted-foreground">
                  Your data is encrypted and protected with industry-standard security
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleMaybeLater} className="w-full sm:w-auto">
              Maybe Later
            </Button>
            <Button onClick={handleCreateAccount} className="w-full sm:w-auto">
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthModal open={showAuth} onOpenChange={handleAuthModalClose} defaultTab="signup" />
    </>
  )
}
