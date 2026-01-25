'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { logger } from '@/lib/logger'
import { trackAuthEvent } from '@/lib/analytics'
import { linkDeviceToUser } from '@/lib/auth/migrate-device-data'

type LoginFormProps = {
  onSuccess?: () => void
  onSwitchToSignup?: () => void
}

export function LoginForm({ onSwitchToSignup }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please enter both email and password')
      return
    }

    setLoading(true)

    try {
      // Use server-side API which sets cookies directly
      logger.info('[Login] Attempting login via API route')

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
        credentials: 'include', // Important: include cookies in the request/response
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      logger.info('[Login] User logged in successfully:', data.user?.id)

      // Set the session on the client if we received tokens
      if (data.session) {
        const supabase = createClient()
        try {
          await supabase.auth.setSession({
            access_token: data.session.accessToken,
            refresh_token: data.session.refreshToken,
          })
          logger.info('[Login] Client session set successfully')
        } catch (sessionErr) {
          logger.warn('[Login] Failed to set client session:', sessionErr)
          // Continue anyway - cookies are set, page reload will work
        }
      }

      // Handle device migration if profile exists
      if (data.profile?.id) {
        logger.info('[Login] Starting device migration')
        try {
          await linkDeviceToUser(data.profile.id)
          logger.info('[Login] Device migration completed')
        } catch (migrationError) {
          logger.warn('[Login] Device migration failed:', migrationError)
          // Continue even if migration fails - not critical
        }
      }

      // Track login event
      await trackAuthEvent('login')

      // Show success message
      setSuccess(true)

      // Force page reload to ensure middleware picks up the session cookies
      setTimeout(() => {
        window.location.href = '/'
      }, 1500)
    } catch (err) {
      logger.error('[Login] Error:', err)

      if (err instanceof Error) {
        const message = err.message.toLowerCase()

        // Be specific about credential errors - don't catch other "invalid" errors
        if (message.includes('invalid login credentials') || message === 'invalid email or password') {
          setError('Invalid email or password')
        } else if (message.includes('email not confirmed') || message.includes('confirm your email')) {
          setError('Please verify your email address before logging in')
        } else if (message.includes('load failed') || message.includes('failed to fetch') || message.includes('network')) {
          setError('Unable to connect to the server. Please check your internet connection.')
        } else if (message.includes('api key') || message.includes('configuration')) {
          setError('Server configuration error. Please try again later.')
          logger.error('[Login] Configuration error:', err.message)
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

    // For password reset, we still use the client-side Supabase call
    // because it doesn't require the same CORS handling
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

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold">Welcome Back!</h3>
        <p className="text-sm text-muted-foreground">
          Login successful. Redirecting you to RunSmart AI...
        </p>
      </div>
    )
  }

  if (resetSent) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-xl font-semibold">Check Your Email</h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a password reset link to <strong>{email}</strong>
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
          Don&apos;t have an account?{' '}
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
