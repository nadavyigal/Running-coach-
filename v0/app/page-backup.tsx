'use client';

import { useState, useEffect } from "react"
import dynamic from 'next/dynamic'
const OnboardingScreen = dynamic(() => import("@/components/onboarding-screen").then(m => m.OnboardingScreen), { ssr: false })
const TodayScreen = dynamic(() => import("@/components/today-screen-min").then(m => m.TodayScreen), { ssr: false })
const PlanScreen = dynamic(() => import("@/components/plan-screen").then(m => m.PlanScreen), { ssr: false })
const RecordScreen = dynamic(() => import("@/components/record-screen").then(m => m.RecordScreen), { ssr: false })
const ChatScreen = dynamic(() => import("@/components/chat-screen").then(m => m.ChatScreen), { ssr: false })
const ProfileScreen = dynamic(() => import("@/components/profile-screen").then(m => m.ProfileScreen), { ssr: false })
const PerformanceAnalyticsDashboard = dynamic(() => import("@/components/performance-analytics-dashboard").then(m => m.PerformanceAnalyticsDashboard), { ssr: false })
const BottomNavigation = dynamic(() => import("@/components/bottom-navigation").then(m => m.BottomNavigation), { ssr: false })
const OnboardingDebugPanel = dynamic(() => import("@/components/onboarding-debug-panel").then(m => m.OnboardingDebugPanel), { ssr: false })
import { dbUtils } from "@/lib/dbUtils"
// import { planAdjustmentService } from "@/lib/planAdjustmentService"
// import { onboardingManager } from "@/lib/onboardingManager"
import { useChunkErrorHandler } from "@/components/chunk-error-boundary"

export default function RunSmartApp() {
  const [currentScreen, setCurrentScreen] = useState<string>("today")
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true) // Start with true to check onboarding state
  const [hasError] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [safeMode, setSafeMode] = useState(false)

  // Add chunk error handler
  useChunkErrorHandler()

  console.log('🚀 RunSmartApp component rendering...')

  useEffect(() => {
    console.log('🔍 RunSmartApp useEffect running...')
    // Safe mode to bypass dynamic imports if needed: add ?safe=1 to URL
    try {
      if (typeof window !== 'undefined') {
        const usp = new URLSearchParams(window.location.search)
        if (usp.get('safe') === '1') {
          console.warn('[app:safe] Safe mode enabled via ?safe=1')
          setSafeMode(true)
          setIsLoading(false)
          return
        }
      }
    } catch {}
    
    // Test database initialization
    // Removed unused testDatabase helper to satisfy linter
    
    // Initialize app state with enhanced user identity resolution
    const initializeApp = async () => {
      if (typeof window !== 'undefined') {
        try {
          console.log('[app:init:start] Starting enhanced application initialization...')
          
          // Step 1: Initialize database with timeout
          const dbInitTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database init timeout (5s)')), 5000)
          );
          
          const dbInit = dbUtils.initializeDatabase?.()
          if (dbInit) {
            await Promise.race([dbInit, dbInitTimeout])
            console.log('[app:init:db] ✅ Database initialized successfully')
          }
          
          // Step 2: Perform startup migration  
          console.log('[app:init:migration] Running startup migration...')
          const migrationSuccess = await dbUtils.performStartupMigration?.()
          if (migrationSuccess) {
            console.log('[app:init:migration] ✅ Startup migration completed')
          } else {
            console.warn('[app:init:migration] ⚠️ Startup migration had issues (continuing)')
          }
          
          // Step 3: Ensure user is ready (this guarantees a user exists)
          console.log('[app:init:user] Ensuring user identity is ready...')
          const readyUser = await dbUtils.ensureUserReady?.()
          if (readyUser) {
            console.log(`[app:init:user] ✅ User ready: id=${readyUser.id}, onboarding=${readyUser.onboardingComplete}`)
            
            // Set onboarding state based on actual user data
            if (readyUser.onboardingComplete) {
              setIsOnboardingComplete(true)
              setCurrentScreen("today")
              localStorage.setItem("onboarding-complete", "true")
              console.log('[app:init:nav] ✅ User ready - navigating to today screen')
            } else {
              setIsOnboardingComplete(false)
              console.log('[app:init:nav] 📝 User needs onboarding - showing onboarding screen')
            }
          } else {
            // Fallback if ensureUserReady failed
            throw new Error('Failed to ensure user is ready')
          }
          
        } catch (initErr) {
          console.error('[app:init:error] ❌ Enhanced initialization failed:', initErr)
          
          // Fallback to localStorage check
          try {
            console.log('[app:init:fallback] Falling back to localStorage check...')
            const onboardingComplete = localStorage.getItem("onboarding-complete")
            if (onboardingComplete === "true") {
              setIsOnboardingComplete(true)
              setCurrentScreen("today")
              console.log('[app:init:fallback] ✅ localStorage fallback - navigating to today')
            } else {
              setIsOnboardingComplete(false)
              console.log('[app:init:fallback] 📝 localStorage fallback - showing onboarding')
            }
          } catch (fallbackError) {
            console.warn('[app:init:fallback] ⚠️ localStorage fallback failed:', fallbackError)
            setIsOnboardingComplete(false)
          }
        }
      } else {
        console.log('[app:init:ssr] 📝 Server-side render, showing onboarding')
        setIsOnboardingComplete(false)
      }
      
      // CRITICAL: Always set loading to false
      console.log('[app:init:complete] ✅ App initialization complete, setting loading to false')
      setIsLoading(false)
    }

    initializeApp()
  }, [])

  // Separate useEffect for event listeners to avoid SSR issues
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return

    console.log('🔗 Adding navigation event listeners...')

    // Listen for navigation events
    const handleNavigateToRecord = () => {
      console.log('🎯 Navigating to record screen')
      setCurrentScreen("record")
    }

    const handleNavigateToAnalytics = () => {
      console.log('📊 Navigating to analytics screen')
      setCurrentScreen("analytics")
    }
    
    const handleNavigateToChat = () => {
      console.log('💬 Navigating to chat screen')
      setCurrentScreen("chat")
    }

    // Add keyboard shortcut for debug panel (Ctrl+Shift+D)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        setShowDebugPanel(prev => !prev)
      }
    }

    // Add event listeners
    window.addEventListener("navigate-to-record", handleNavigateToRecord)
    window.addEventListener("navigate-to-analytics", handleNavigateToAnalytics)
    window.addEventListener("navigate-to-chat", handleNavigateToChat)
    window.addEventListener("keydown", handleKeyDown)

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up navigation event listeners...')
      window.removeEventListener("navigate-to-record", handleNavigateToRecord)
      window.removeEventListener("navigate-to-analytics", handleNavigateToAnalytics)
      window.removeEventListener("navigate-to-chat", handleNavigateToChat)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [showDebugPanel])

  const handleOnboardingComplete = async (userData?: any) => {
    console.log('✅ Onboarding completed by user with data:', userData)
    
    await dbUtils.completeOnboardingAtomic(userData);

    const finalUserData = userData || {
      experience: 'beginner',
      goal: 'habit',
      daysPerWeek: 3,
      preferredTimes: ['morning'],
      age: 30,
    };
      
    setIsOnboardingComplete(true)
    setCurrentScreen("today")
    localStorage.setItem("onboarding-complete", "true")
    localStorage.setItem("user-data", JSON.stringify(finalUserData))
    console.log('✅ Profile-ready confirmed; navigating to Today')
  }

  console.log('🎭 Current screen:', currentScreen, 'Onboarding complete:', isOnboardingComplete, 'Loading:', isLoading, 'Error:', hasError)

  if (isLoading) {
    console.log('⏳ Showing loading state...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading RunSmart...</p>
          <p className="mt-2 text-sm text-gray-500">This may take a few seconds</p>
        </div>
      </div>
    )
  }

  if (safeMode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-2xl font-semibold">App baseline OK</div>
          <div className="text-gray-600">Safe mode bypassed dynamic imports. Remove ?safe=1 to load full app.</div>
        </div>
      </div>
    )
  }

  // If there was an error or timeout, show onboarding as fallback
  if (hasError) {
    console.log('⚠️ Showing onboarding due to error/timeout')
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
        <div className="pb-20">
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </div>
      </div>
    )
  }

  const renderScreen = () => {
    // Always show onboarding if not completed, regardless of currentScreen
    if (!isOnboardingComplete) {
      console.log('🎓 Rendering full onboarding screen with AI goal wizard')
      return (
        <OnboardingScreen 
          onComplete={handleOnboardingComplete}
        />
      )
    }

    console.log('📱 Rendering main app with screen:', currentScreen)
    
    switch (currentScreen) {
      case "today":
        return <TodayScreen />
      case "plan":
        return <PlanScreen />
      case "record":
        return <RecordScreen />
      case "analytics":
        return <PerformanceAnalyticsDashboard userId={1} />
      case "chat":
        return <ChatScreen />
      case "profile":
        return <ProfileScreen />
      default:
        return <TodayScreen />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
      <div className="pb-20">{renderScreen()}</div>
      {isOnboardingComplete && <BottomNavigation currentScreen={currentScreen} onScreenChange={setCurrentScreen} />}
      
      {/* Debug Panel - Access with Ctrl+Shift+D */}
      <OnboardingDebugPanel 
        isOpen={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)} 
      />
    </div>
  )
}