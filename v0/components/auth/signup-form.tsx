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

type SignupFormProps = {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const validateForm = (): string | null => {
    if (!email.trim()) {
      return 'Email is required'
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address'
    }

    if (!password) {
      return 'Password is required'
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters'
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter'
    }

    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter'
    }

    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number'
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match'
    }

    return null
  }

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate form
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      // Use server-side API which sets cookies directly
      logger.info('[Signup] Attempting signup via API route')

      const response = await fetch('/api/auth/signup', {
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
        throw new Error(data.error || 'Signup failed')
      }

      logger.info('[Signup] User created successfully:', data.user?.id)

      // Set the session on the client if we received tokens
      if (data.session) {
        const supabase = createClient()
        try {
          await supabase.auth.setSession({
            access_token: data.session.accessToken,
            refresh_token: data.session.refreshToken,
          })
          logger.info('[Signup] Client session set successfully')
        } catch (sessionErr) {
          logger.warn('[Signup] Failed to set client session:', sessionErr)
          // Continue anyway - cookies are set, page reload will work
        }
      }

      // Track signup event
      await trackAuthEvent('signup')

      // Show success message
      setSuccess(true)

      // Force page reload to ensure middleware picks up the session cookies
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err) {
      logger.error('[Signup] Error:', err)

      if (err instanceof Error) {
        const message = err.message.toLowerCase()

        if (message.includes('already registered')) {
          setError('This email is already registered. Please log in instead.')
        } else if (message.includes('load failed') || message.includes('failed to fetch') || message.includes('network')) {
          setError('Unable to connect to the server. Please check your internet connection and try again.')
          logger.error('[Signup] Network error')
        } else if (message.includes('api key') || message.includes('configuration')) {
          setError('Server configuration error. Please try again later.')
          logger.error('[Signup] Configuration error:', err.message)
        } else {
          setError(err.message)
        }
      } else {
        setError('Signup failed. Please try again.')
      }
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
        <h3 className="text-xl font-semibold">Account Created!</h3>
        <p className="text-sm text-muted-foreground">
          Your account is ready. Redirecting you to get started with RunSmart AI...
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
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
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">
          Must include uppercase, lowercase, and number
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-confirm-password">Confirm Password</Label>
        <Input
          id="signup-confirm-password"
          name="confirmPassword"
          type="password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          required
          autoComplete="new-password"
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
            Creating account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>

      {onSwitchToLogin && (
        <div className="text-center text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary hover:underline"
            disabled={loading}
          >
            Log in
          </button>
        </div>
      )}
    </form>
  )
}
