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

type SignupFormProps = {
  onSuccess: () => void
  onSwitchToLogin?: () => void
}

export function SignupForm({ onSuccess, onSwitchToLogin }: SignupFormProps) {
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
    const supabase = createClient()

    try {
      // Sign up user
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signupError) throw signupError

      if (!data.user) {
        throw new Error('Signup failed: No user returned')
      }

      logger.info('[Signup] User created successfully:', data.user.id)

      // Create profile for the user
      const { error: profileError } = await supabase.from('profiles').insert({
        auth_user_id: data.user.id,
        goal: 'habit', // Default goal, will be updated during onboarding
        experience: 'beginner', // Default experience
        preferred_times: [],
        days_per_week: 3, // Default
        onboarding_complete: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (profileError) {
        logger.error('[Signup] Error creating profile:', profileError)
        throw new Error('Failed to create user profile')
      }

      logger.info('[Signup] Profile created successfully')

      // Get profile_id for migration
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', data.user.id)
        .single()

      if (profile) {
        // Link device data and perform initial sync
        logger.info('[Signup] Starting device migration')
        try {
          await linkDeviceToUser(profile.id)
          logger.info('[Signup] Device migration completed')
        } catch (migrationError) {
          logger.warn('[Signup] Device migration failed:', migrationError)
          // Continue even if migration fails - not critical
        }
      }

      // Track signup event
      await trackAuthEvent('signup')

      // Show success message
      setSuccess(true)

      // Wait 2 seconds before calling onSuccess
      setTimeout(() => {
        onSuccess()
      }, 2000)
    } catch (err) {
      logger.error('[Signup] Error:', err)

      if (err instanceof Error) {
        if (err.message.includes('already registered')) {
          setError('This email is already registered. Please log in instead.')
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
          Check your email to verify your account, then you can start using RunSmart AI.
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
