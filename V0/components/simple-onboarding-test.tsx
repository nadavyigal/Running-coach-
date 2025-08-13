'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface SimpleOnboardingTestProps {
  onComplete: () => void
}

export function SimpleOnboardingTest({ onComplete }: SimpleOnboardingTestProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const { toast } = useToast()

  const handleDirectComplete = async () => {
    console.log('🚀 DIRECT ONBOARDING COMPLETION')
    console.log('🔎 Before onComplete(), localStorage.onboarding-complete:', typeof window !== 'undefined' ? localStorage.getItem('onboarding-complete') : 'ssr')
    setIsCompleting(true)

    try {
      // Show success toast
      toast({
        title: "Success!",
        description: "Your running journey is starting now!",
      })

      // Small delay to show the message
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log('✅ Calling onComplete()...')
      
      // Call the completion handler
      onComplete()
      
      console.log('🎉 onComplete() called successfully!')
      console.log('🔎 After onComplete(), localStorage.onboarding-complete:', typeof window !== 'undefined' ? localStorage.getItem('onboarding-complete') : 'ssr')

    } catch (error) {
      console.error('❌ Error in completion:', error)
      
      // Try again anyway
      toast({
        title: "Starting...",
        description: "Welcome to your running journey!",
      })
      
      setTimeout(() => {
        onComplete()
      }, 500)
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 p-4 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 shadow-xl max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          🏃‍♂️ Simple Onboarding Test
        </h1>
        
        <p className="text-gray-600 mb-6">
          This is a simple test to see if onboarding completion works.
        </p>

        <Button 
          onClick={handleDirectComplete}
          disabled={isCompleting}
          className="w-full bg-green-500 hover:bg-green-600"
        >
          {isCompleting ? 'Starting Your Journey...' : 'Start My Journey Now'}
        </Button>

        <div className="mt-4 text-sm text-gray-500">
          <p>This should:</p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Set localStorage flag</li>
            <li>Call onComplete()</li>
            <li>Navigate to today screen</li>
          </ol>
        </div>
      </div>
    </div>
  )
}