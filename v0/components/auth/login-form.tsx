'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import { logger } from '@/lib/logger'
import { trackAuthEvent } from '@/lib/analytics'
import { linkDeviceToUser } from '@/lib/auth/migrate-device-data'

type LoginFormProps = {
  onSuccess: () => void
  onSwitchToSignup?: () => void
}

export function LoginForm({ onSuccess, onSwitchToSignup }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please enter both email and password')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (loginError) throw loginError

      if (!data.user) {
        throw new Error('Login failed: No user returned')
      }

      logger.info('[Login] User logged in successfully:', data.user.id)

      // Get profile_id for migration
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', data.user.id)
        .single()

      if (profile) {
        // Link device data and perform initial sync (if not already done)
        logger.info('[Login] Starting device migration')
        try {
          await linkDeviceToUser(profile.id)
          logger.info('[Login] Device migration completed')
        } catch (migrationError) {
          logger.warn('[Login] Device migration failed:', migrationError)
          // Continue even if migration fails - not critical
        }
      }

      // Track login event
      await trackAuthEvent('login')

      // Call onSuccess to close modal/redirect
      onSuccess()
    } catch (err) {
      logger.error('[Login] Error:', err)

      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials')) {
          setError('Invalid email or password')
        } else if (err.message.includes('Email not confirmed')) {
          setError('Please verify your email address before logging in')
        } else {
          setError(err.message)
        }
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (error) throw error

      setResetSent(true)
      logger.info('[Login] Password reset email sent to:', email)
    } catch (err) {
      logger.error('[Login] Password reset error:', err)
      setError('Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (resetSent) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-xl font-semibold">Check Your Email</h3>
        <p className="text-sm text-muted-foreground">
          We've sent a password reset link to <strong>{email}</strong>
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setResetSent(false)}
          className="w-full"
        >
          Back to Login
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-primary hover:underline"
            disabled={loading}
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="login-password"
          name="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
          autoComplete="current-password"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Logging in...
          </>
        ) : (
          'Log In'
        )}
      </Button>

      {onSwitchToSignup && (
        <div className="text-center text-sm">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-primary hover:underline"
            disabled={loading}
          >
            Sign up
          </button>
        </div>
      )}
    </form>
  )
}
