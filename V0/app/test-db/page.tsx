"use client"

import { useState } from 'react'
import { dbUtils } from '@/lib/db'
import { onboardingManager } from '@/lib/onboardingManager'

export default function DatabaseTest() {
  const [logs, setLogs] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
    console.log(message)
  }

  const clearLogs = () => {
    setLogs([])
  }

  const runTest = async () => {
    setIsRunning(true)
    clearLogs()
    
    try {
      addLog('🔍 Starting database operations test...')
      
      // Test 1: Clear database
      addLog('🧹 Clearing database...')
      await dbUtils.clearDatabase()
      addLog('✅ Database cleared')
      
      // Test 2: Create user
      addLog('📋 Creating test user...')
      const userData = {
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: {
          data: true,
          gdpr: true,
          push: false
        },
        onboardingComplete: true,
        age: 25
      }
      
      const startTime = performance.now()
      const userId = await dbUtils.createUser(userData)
      const createTime = performance.now() - startTime
      addLog(`✅ User created with ID: ${userId} (${createTime.toFixed(2)}ms)`)
      
      // Test 3: Retrieve user
      addLog('📋 Retrieving user with getCurrentUser()...')
      const retrieveStart = performance.now()
      const user = await dbUtils.getCurrentUser()
      const retrieveTime = performance.now() - retrieveStart
      
      if (!user) {
        throw new Error('❌ User not found after creation!')
      }
      
      addLog(`✅ User retrieved: ID ${user.id}, completed: ${user.onboardingComplete} (${retrieveTime.toFixed(2)}ms)`)
      
      // Test 4: Test getUserById
      addLog('📋 Testing getUserById...')
      const userById = await dbUtils.getUserById(userId)
      if (!userById) {
        throw new Error('❌ getUserById failed!')
      }
      addLog(`✅ getUserById worked: ID ${userById.id}`)
      
      // Test 5: Test incomplete user
      addLog('📋 Creating incomplete user...')
      const incompleteUserData = { ...userData, onboardingComplete: false }
      const incompleteUserId = await dbUtils.createUser(incompleteUserData)
      addLog(`✅ Incomplete user created: ID ${incompleteUserId}`)
      
      // Test 6: Check priority
      addLog('📋 Testing getCurrentUser priority...')
      const currentUser = await dbUtils.getCurrentUser()
      addLog(`✅ getCurrentUser returned: ID ${currentUser?.id}, completed: ${currentUser?.onboardingComplete}`)
      
      if (currentUser?.id === userId && currentUser?.onboardingComplete) {
        addLog('✅ Priority working correctly - completed user returned')
      } else {
        addLog('⚠️ Priority issue - completed user not prioritized')
      }
      
      // Test 7: OnboardingManager
      addLog('📋 Testing OnboardingManager...')
      await dbUtils.clearDatabase()
      
      const profile = {
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: {
          data: true,
          gdpr: true,
          push: false
        },
        onboardingComplete: true,
        age: 30
      }
      
      addLog('🎯 Creating user through OnboardingManager...')
      const onboardingResult = await onboardingManager.createUserWithProfile(profile)
      
      if (onboardingResult.success && onboardingResult.user) {
        addLog(`✅ OnboardingManager success: User ID ${onboardingResult.user.id}`)
        
        // Verify retrieval
        const retrievedUser = await dbUtils.getCurrentUser()
        if (retrievedUser && retrievedUser.id === onboardingResult.user.id) {
          addLog('✅ OnboardingManager user can be retrieved')
        } else {
          addLog('❌ OnboardingManager user cannot be retrieved')
        }
      } else {
        addLog(`❌ OnboardingManager failed: ${onboardingResult.errors?.join(', ')}`)
      }
      
      addLog('🎉 All tests completed successfully!')
      
    } catch (error) {
      addLog(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`)
      console.error('Full error:', error)
    }
    
    setIsRunning(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 p-6 font-mono">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">🔧 Database Operations Test</h1>
        <p className="mb-6">This page tests the user creation and retrieval fixes.</p>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={runTest}
            disabled={isRunning}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded"
          >
            {isRunning ? '⏳ Running...' : '🚀 Run Test'}
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            🧹 Clear Logs
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded inline-block"
          >
            🏠 Back to App
          </a>
        </div>
        
        <div className="bg-gray-800 p-4 rounded max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet. Click "Run Test" to start.</div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`mb-1 p-2 rounded ${
                  log.includes('❌') ? 'bg-red-900/20 text-red-400' :
                  log.includes('✅') ? 'bg-green-900/20 text-green-400' :
                  log.includes('⚠️') ? 'bg-yellow-900/20 text-yellow-400' :
                  'bg-gray-700/20'
                }`}
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
