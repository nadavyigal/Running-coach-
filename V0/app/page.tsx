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
import { dbUtils } from "@/lib/db"
import { planAdjustmentService } from "@/lib/planAdjustmentService"

export default function RunSmartApp() {
  const [currentScreen, setCurrentScreen] = useState<string>("onboarding")
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)

  useEffect(() => {
    // Check if onboarding is complete by checking database
    const checkOnboardingStatus = async () => {
      try {
        const user = await dbUtils.getCurrentUser()
        if (user && user.onboardingComplete) {
          setIsOnboardingComplete(true)
          setCurrentScreen("today")
          planAdjustmentService.init(user.id!)
        } else {
          // Check localStorage for backward compatibility
          const onboardingComplete = localStorage.getItem("onboarding-complete")
          if (onboardingComplete) {
            // Migrate from localStorage
            await dbUtils.migrateFromLocalStorage()
            const migratedUser = await dbUtils.getCurrentUser()
            if (migratedUser) {
              planAdjustmentService.init(migratedUser.id!)
            }
            setIsOnboardingComplete(true)
            setCurrentScreen("today")
          }
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error)
      }
    }

    checkOnboardingStatus()

    // Listen for navigation events
    const handleNavigateToRecord = () => {
      setCurrentScreen("record")
    }

    const handleNavigateToAnalytics = () => {
      setCurrentScreen("analytics")
    }

    if (typeof window !== "undefined") {
      window.addEventListener("navigate-to-record", handleNavigateToRecord)
      window.addEventListener("navigate-to-analytics", handleNavigateToAnalytics)
    }

    // Cleanup function
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("navigate-to-record", handleNavigateToRecord)
        window.removeEventListener("navigate-to-analytics", handleNavigateToAnalytics)
      }
    }
  }, [])

  const handleOnboardingComplete = () => {
    setIsOnboardingComplete(true)
    setCurrentScreen("today")
  }

  const renderScreen = () => {
    if (!isOnboardingComplete && currentScreen === "onboarding") {
      return <OnboardingScreen onComplete={handleOnboardingComplete} />
    }

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
    </div>
  )
}