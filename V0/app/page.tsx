'use client';

import { useState, useEffect } from "react"
import { OnboardingScreen } from "@/components/onboarding-screen"
import { TodayScreen } from "@/components/today-screen"
import { PlanScreen } from "@/components/plan-screen"
import { RecordScreen } from "@/components/record-screen"
import { ChatScreen } from "@/components/chat-screen"
import { ProfileScreen } from "@/components/profile-screen"
import { PerformanceAnalyticsDashboard } from "@/components/performance-analytics-dashboard"
import { BottomNavigation } from "@/components/bottom-navigation"
import { OnboardingDebugPanel } from "@/components/onboarding-debug-panel"
import { dbUtils } from "@/lib/db"
import { planAdjustmentService } from "@/lib/planAdjustmentService"
import { onboardingManager } from "@/lib/onboardingManager"
import { useChunkErrorHandler } from "@/components/chunk-error-boundary"

export default function RunSmartApp() {
  const [currentScreen, setCurrentScreen] = useState<string>("today")
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  // Add chunk error handler
  useChunkErrorHandler()

  console.log('🚀 RunSmartApp component rendering...')

  useEffect(() => {
    console.log('🔍 RunSmartApp useEffect running...')
    
    let loadingTimeout: NodeJS.Timeout | null = null
    
    // Check if onboarding is complete by checking database
    const checkOnboardingStatus = async () => {
      try {
        // Add timeout to prevent infinite loading
        loadingTimeout = setTimeout(() => {
          console.log('⏰ Loading timeout reached, showing onboarding as fallback')
          setIsLoading(false)
          setHasError(true)
        }, 5000) // 5 second timeout
        
        console.log('📊 Checking onboarding status...')
        
        // Add safety check to prevent multiple execution
        if (!isLoading) {
          console.log('🛑 Loading already completed, skipping check')
          return
        }
        
        const user = await dbUtils.getCurrentUser()
        console.log('👤 User found:', user ? 'Yes' : 'No')
        
        if (user && user.onboardingComplete) {
          console.log('✅ Onboarding complete, setting screen to today')
          setIsOnboardingComplete(true)
          setCurrentScreen("today")
          planAdjustmentService.init(user.id!)
        } else {
          // Check localStorage for backward compatibility only if in browser
          if (typeof window !== 'undefined') {
            console.log('🔍 Checking localStorage for onboarding status...')
            const onboardingComplete = localStorage.getItem("onboarding-complete")
            if (onboardingComplete) {
              console.log('🔄 Migrating from localStorage...')
              // Migrate from localStorage
              await dbUtils.migrateFromLocalStorage()
              const migratedUser = await dbUtils.getCurrentUser()
              if (migratedUser) {
                planAdjustmentService.init(migratedUser.id!)
              }
              setIsOnboardingComplete(true)
              setCurrentScreen("today")
            } else {
              console.log('📝 Onboarding not complete, staying on onboarding screen')
            }
          } else {
            console.log('📝 Server-side render, skipping localStorage check')
          }
        }
      } catch (error) {
        console.error('❌ Failed to check onboarding status:', error)
        setHasError(true)
      } finally {
        if (loadingTimeout) {
          clearTimeout(loadingTimeout)
        }
        setIsLoading(false)
      }
    }

    checkOnboardingStatus()
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

  const handleOnboardingComplete = async () => {
    console.log('✅ Onboarding completed by user')
    
    // Wait for onboarding to finish and verify data was saved
    try {
      console.log('🔍 Waiting for onboarding to complete and verifying data...')
      
      // Wait a moment for onboarding operations to finish
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Verify user was created successfully
      const user = await dbUtils.getCurrentUser()
      if (!user) {
        console.error('❌ No user found after onboarding completion')
        throw new Error('User creation failed during onboarding')
      }
      
      console.log('✅ User verified:', { id: user.id, onboardingComplete: user.onboardingComplete })
      
      // Verify user has onboarding complete flag
      if (!user.onboardingComplete) {
        console.error('❌ User onboarding not marked as complete')
        throw new Error('Onboarding completion not properly saved')
      }
      
      // Verify user has an active plan
      const activePlan = await dbUtils.getActivePlan(user.id!)
      if (!activePlan) {
        console.error('❌ No active plan found after onboarding completion')
        throw new Error('Training plan creation failed during onboarding')
      }
      
      console.log('✅ Active plan verified:', { id: activePlan.id, title: activePlan.title })
      
      // Initialize plan adjustment service with the user
      try {
        planAdjustmentService.init(user.id!)
        console.log('✅ Plan adjustment service initialized')
      } catch (error) {
        console.error('⚠️ Failed to initialize plan adjustment service:', error)
        // Don't throw here, this is not critical for the onboarding flow
      }
      
      // All verifications passed, update app state
      console.log('🎉 Onboarding verification complete, transitioning to Today screen')
      setIsOnboardingComplete(true)
      setCurrentScreen("today")
      
    } catch (error) {
      console.error('❌ Onboarding completion verification failed:', error)
      
      // Show error state but don't navigate away
      setHasError(true)
      
      // Reset onboarding state to allow retry
      onboardingManager.resetOnboardingState()
      
      // Optional: Show user-friendly error message
      if (typeof window !== 'undefined') {
        alert('Onboarding completion failed. Please try again or refresh the page.')
      }
    }
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
      console.log('🎓 Rendering onboarding screen - onboarding not complete')
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