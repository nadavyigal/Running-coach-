'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const sessionReadyRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    // Fast path: check for an existing cookie-based session immediately.
    // The server-side callback route calls verifyOtp / exchangeCodeForSession
    // and sets the session in a cookie before redirecting here, so getSession()
    // will return a session on first call most of the time.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        sessionReadyRef.current = true
        setSessionReady(true)
      }
    })

    // Also listen for the PASSWORD_RECOVERY event, which Supabase fires when
    // the user arrives via a hash-based implicit-flow link
    // (e.g. /auth/reset-password#access_token=xxx&type=recovery).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        sessionReadyRef.current = true
        setSessionReady(true)
        setError(null)
      }
    })

    // Safety net: if neither path detected a session within 3 seconds, show error.
    const timer = setTimeout(() => {
      if (!sessionReadyRef.current) {
        setError(
          'Your password reset link has expired or is invalid. Please request a new one.'
        )
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) throw updateError

      logger.info('[ResetPassword] Password updated successfully')
      setSuccess(true)

      setTimeout(() => {
        router.push('/')
      }, 2500)
    } catch (err) {
      logger.error('[ResetPassword] Error:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to update password. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h1 className="text-2xl font-bold">Password Updated!</h1>
          <p className="text-muted-foreground">
            Your password has been changed. Redirecting you to RunSmart…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter a new password for your RunSmart account.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sessionReady && !error ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update Password'
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => router.push('/')}
              >
                Cancel — go to RunSmart
              </button>
            </div>
          </form>
        ) : !error ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Return to RunSmart and use &ldquo;Forgot password?&rdquo; to request a fresh link.
            </p>
            <Button onClick={() => router.push('/')}>Go to RunSmart</Button>
          </div>
        )}
      </div>
    </div>
  )
}
