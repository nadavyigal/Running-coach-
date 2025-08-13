"use client"

import { useState } from 'react'
import { dbUtils } from '@/lib/db'

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
    console.log(message)
  }

  const clearLogs = () => {
    setLogs([])
  }

  const resetEverything = async () => {
    setIsRunning(true)
    try {
      addLog('🔄 Resetting everything...')
      
      // Clear localStorage
      localStorage.clear()
      addLog('✅ localStorage cleared')
      
      // Clear database
      await dbUtils.clearDatabase()
      addLog('✅ Database cleared')
      
      // Clear IndexedDB
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases()
        for (const db of databases) {
          if (db.name) {
            const deleteReq = indexedDB.deleteDatabase(db.name)
            await new Promise((resolve, reject) => {
              deleteReq.onsuccess = () => resolve(undefined)
              deleteReq.onerror = () => reject(deleteReq.error)
            })
            addLog(`✅ Deleted database: ${db.name}`)
          }
        }
      }
      
      addLog('🎉 Complete reset done - reload the page!')
      
    } catch (error) {
      addLog(`❌ Reset failed: ${error}`)
    }
    setIsRunning(false)
  }

  const testUserFlow = async () => {
    setIsRunning(true)
    clearLogs()
    
    try {
      addLog('🔍 Testing user creation and retrieval flow...')
      
      // Step 1: Clear everything
      await dbUtils.clearDatabase()
      localStorage.removeItem('onboarding-complete')
      addLog('🧹 Cleared database and localStorage')
      
      // Step 2: Create user as the app does
      addLog('📋 Creating user via upsertUser (like the app)...')
      const userData = {
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        onboardingComplete: true,
      }
      
      const userId = await dbUtils.upsertUser(userData)
      addLog(`✅ User created with ID: ${userId}`)
      
      // Step 3: Try to get current user (this is where it fails)
      addLog('📋 Attempting getCurrentUser() (this is where it fails)...')
      const currentUser = await dbUtils.getCurrentUser()
      
      if (currentUser) {
        addLog(`✅ getCurrentUser() SUCCESS: ID ${currentUser.id}, completed: ${currentUser.onboardingComplete}`)
      } else {
        addLog('❌ getCurrentUser() FAILED - returned null (THIS IS THE BUG)')
      }
      
      // Step 4: Try direct user retrieval by ID
      addLog('📋 Trying getUserById()...')
      const userById = await dbUtils.getUserById(userId)
      if (userById) {
        addLog(`✅ getUserById() works: ID ${userById.id}`)
      } else {
        addLog('❌ getUserById() also failed')
      }
      
      // Step 5: List all users
      addLog('📋 Listing all users in database...')
      const db = await import('@/lib/db')
      const database = db.getDatabase()
      if (database) {
        const allUsers = await database.users.toArray()
        addLog(`📊 Found ${allUsers.length} users in database`)
        allUsers.forEach((user, index) => {
          addLog(`  User ${index + 1}: ID ${user.id}, completed: ${user.onboardingComplete}`)
        })
      }
      
    } catch (error) {
      addLog(`❌ Test failed: ${error}`)
      console.error('Full error:', error)
    }
    
    setIsRunning(false)
  }

  const checkAppState = () => {
    addLog('🔍 Checking current app state...')
    addLog(`localStorage onboarding-complete: ${localStorage.getItem('onboarding-complete')}`)
    addLog(`localStorage user-data: ${localStorage.getItem('user-data')}`)
    
    // Check if there are any users in the database
    dbUtils.getCurrentUser().then(user => {
      if (user) {
        addLog(`Current user in DB: ID ${user.id}, completed: ${user.onboardingComplete}`)
      } else {
        addLog('No current user found in database')
      }
    }).catch(error => {
      addLog(`Error getting current user: ${error}`)
    })
  }

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 p-6 font-mono">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">🔧 Debug Page</h1>
        <p className="mb-6">Debug the user not found issue</p>
        
        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={testUserFlow}
            disabled={isRunning}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded"
          >
            {isRunning ? '⏳ Testing...' : '🧪 Test User Flow'}
          </button>
          <button
            onClick={checkAppState}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            🔍 Check App State
          </button>
          <button
            onClick={resetEverything}
            disabled={isRunning}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded"
          >
            🔥 Reset Everything
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
          >
            🧹 Clear Logs
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded inline-block"
          >
            🏠 Back to App
          </a>
        </div>
        
        <div className="bg-gray-800 p-4 rounded max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet. Click a button to start debugging.</div>
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