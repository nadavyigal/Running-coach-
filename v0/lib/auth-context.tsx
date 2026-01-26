'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

type AuthContextType = {
  user: User | null
  profileId: string | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          logger.error('[Auth] Error getting session:', error)
          setUser(null)
          setProfileId(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
        } else {
          // Fallback: check server session cookie (httpOnly) via API
          try {
            const response = await fetch('/api/auth/session', { credentials: 'include' })
            if (response.ok) {
              const data = await response.json()
              if (data?.user) {
                setUser(data.user as User)
                setProfileId(data.profileId ?? null)
              } else {
                setUser(null)
                setProfileId(null)
              }
            } else {
              setUser(null)
              setProfileId(null)
            }
          } catch (fallbackError) {
            logger.warn('[Auth] Fallback session check failed:', fallbackError)
            setUser(null)
            setProfileId(null)
          }

          setLoading(false)
          return
        }

        // Fetch profile_id if user is authenticated
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('auth_user_id', session.user.id)
          .single()

        if (profileError) {
          logger.error('[Auth] Error fetching profile:', profileError)
        } else {
          setProfileId(profile?.id ?? null)
          logger.info('[Auth] User authenticated, profile_id:', profile?.id)
        }

        setLoading(false)
      } catch (error) {
        logger.error('[Auth] Error initializing auth:', error)
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.info('[Auth] Auth state changed:', event)

        setUser(session?.user ?? null)

        if (session?.user) {
          // Fetch profile_id for authenticated user
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('auth_user_id', session.user.id)
            .single()

          if (profileError) {
            logger.error('[Auth] Error fetching profile after auth change:', profileError)
            setProfileId(null)
          } else {
            setProfileId(profile?.id ?? null)
          }
        } else {
          setProfileId(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        logger.error('[Auth] Error signing out:', error)
        throw error
      }

      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      } catch (logoutError) {
        logger.warn('[Auth] Logout cookie clear failed:', logoutError)
      }

      setUser(null)
      setProfileId(null)
      logger.info('[Auth] User signed out successfully')
    } catch (error) {
      logger.error('[Auth] Sign out failed:', error)
      throw error
    }
  }

  const refreshSession = async () => {
    const supabase = createClient()

    try {
      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        logger.error('[Auth] Error refreshing session:', error)
        throw error
      }

      setUser(data.session?.user ?? null)

      if (data.session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('auth_user_id', data.session.user.id)
          .single()

        setProfileId(profile?.id ?? null)
      } else {
        setProfileId(null)
      }

      logger.info('[Auth] Session refreshed successfully')
    } catch (error) {
      logger.error('[Auth] Refresh session failed:', error)
      throw error
    }
  }

  const value = {
    user,
    profileId,
    loading,
    signOut,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
