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

export default function RunSmartApp() {
  const [currentScreen, setCurrentScreen] = useState<string>("onboarding")
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  console.log('🚀 RunSmartApp component rendering...')

  useEffect(() => {
    console.log('🔍 RunSmartApp useEffect running...')
    
    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.log('⏰ Loading timeout reached, showing onboarding as fallback')
      setIsLoading(false)
      setHasError(true)
    }, 5000) // 5 second timeout
    
    // Check if onboarding is complete by checking database
    const checkOnboardingStatus = async () => {
      try {
        console.log('📊 Checking onboarding status...')
        const user = await dbUtils.getCurrentUser()
        console.log('👤 User found:', user ? 'Yes' : 'No')
        
        if (user && user.onboardingComplete) {
          console.log('✅ Onboarding complete, setting screen to today')
          setIsOnboardingComplete(true)
          setCurrentScreen("today")
          planAdjustmentService.init(user.id!)
        } else {
          // Check localStorage for backward compatibility
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
        }
      } catch (error) {
        console.error('❌ Failed to check onboarding status:', error)
        setHasError(true)
      } finally {
        clearTimeout(loadingTimeout)
        setIsLoading(false)
      }
    }

    checkOnboardingStatus()

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
        setShowDebugPanel(!showDebugPanel)
      }
    }

    // Add event listeners only if we're in the browser
    if (typeof window !== "undefined") {
      console.log('🔗 Adding navigation event listeners...')
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
        clearTimeout(loadingTimeout)
      }
    }
  }, [])

  const handleOnboardingComplete = async () => {
    console.log('✅ Onboarding completed by user')
    
    // Check if onboarding is still in progress to prevent race conditions
    if (onboardingManager.isOnboardingInProgress()) {
      console.log('⚠️ Onboarding already in progress, waiting...')
      return;
    }
    
    // Initialize plan adjustment service with the user
    try {
      const user = await dbUtils.getCurrentUser()
      if (user?.id) {
        planAdjustmentService.init(user.id)
      }
    } catch (error) {
      console.error('⚠️ Failed to initialize plan adjustment service:', error)
    }
    
    setIsOnboardingComplete(true)
    setCurrentScreen("today")
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
    if (!isOnboardingComplete && currentScreen === "onboarding") {
      console.log('🎓 Rendering onboarding screen')
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