'use client';

import { useState, useEffect, useRef } from "react"
import dynamic from 'next/dynamic'

// Safer dynamic imports with comprehensive error handling
const OnboardingScreen = dynamic(
  () => import("@/components/onboarding-screen").then((module) => {
    console.log('📦 OnboardingScreen module loaded:', { exports: Object.keys(module) });
    if (!module.OnboardingScreen) {
      throw new Error(`OnboardingScreen export not found. Available: ${Object.keys(module).join(', ')}`);
    }
    return { default: module.OnboardingScreen };
  }).catch((error) => {
    console.error('💥 Failed to load OnboardingScreen:', error);
    // Return a fallback component instead of crashing
    return {
      default: ({ onComplete }: { onComplete: () => void }) => (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Loading Error</h2>
          <p className="mb-4">Failed to load onboarding component.</p>
          <button 
            onClick={onComplete}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Continue to App
          </button>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-600">Error Details</summary>
            <pre className="text-xs bg-gray-100 p-2 mt-2 rounded">{error.message}</pre>
          </details>
        </div>
      )
    };
  }),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Onboarding...</p>
        </div>
      </div>
    )
  }
);

const TodayScreen = dynamic(
  () => import("@/components/today-screen").then((module) => {
    console.log('📦 TodayScreen module loaded:', { exports: Object.keys(module) });
    if (!module.TodayScreen) {
      throw new Error(`TodayScreen export not found. Available: ${Object.keys(module).join(', ')}`);
    }
    return { default: module.TodayScreen };
  }).catch((error) => {
    console.error('💥 Failed to load TodayScreen:', error);
    return {
      default: () => (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Loading Error</h2>
          <p className="mb-4">Failed to load today screen component.</p>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-600">Error Details</summary>
            <pre className="text-xs bg-gray-100 p-2 mt-2 rounded">{error.message}</pre>
          </details>
        </div>
      )
    };
  }),
  { 
    ssr: false,
    loading: () => <div className="p-6 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div></div>
  }
);

const PlanScreen = dynamic(() => import("@/components/plan-screen").then(m => ({ default: m.PlanScreen })), { ssr: false })
const RecordScreen = dynamic(() => import("@/components/record-screen").then(m => ({ default: m.RecordScreen })), { ssr: false })
const ChatScreen = dynamic(() => import("@/components/chat-screen").then(m => ({ default: m.ChatScreen })), { ssr: false })
const ProfileScreen = dynamic(() => import("@/components/profile-screen").then(m => ({ default: m.ProfileScreen })), { ssr: false })
const BottomNavigation = dynamic(() => import("@/components/bottom-navigation").then(m => ({ default: m.BottomNavigation })), { ssr: false })
const OnboardingDebugPanel = dynamic(() => import("@/components/onboarding-debug-panel").then(m => ({ default: m.OnboardingDebugPanel })), { ssr: false })

// Import database utilities with better error handling
let dbUtils: any = null;
let seedDemoRoutes: any = null;
try {
  const dbModule = require("@/lib/dbUtils");
  dbUtils = dbModule.dbUtils ?? dbModule.default;
  seedDemoRoutes = dbModule.seedDemoRoutes;
} catch (dbError) {
  console.error('Failed to load database utilities:', dbError);
  // Create mock dbUtils for graceful degradation
  dbUtils = {
    initializeDatabase: async () => { console.warn('Database not available - running in degraded mode'); return true; },
    performStartupMigration: async () => { console.warn('Migration skipped - database not available'); return true; },
    ensureUserReady: async () => { console.warn('User ready check skipped - database not available'); return null; },
    waitForProfileReady: async () => { console.warn('Profile ready check skipped - database not available'); return null; }
  };
}

// Import production diagnostics
let logDiagnostic: any = () => {};
let logDatabaseInit: any = () => {};
let logNavigation: any = () => {};
let logError: any = () => {};
try {
  const diagModule = require("@/lib/productionDiagnostics");
  logDiagnostic = diagModule.logDiagnostic;
  logDatabaseInit = diagModule.logDatabaseInit;
  logNavigation = diagModule.logNavigation;
  logError = diagModule.logError;
} catch {
  // Diagnostics not available - use no-ops
}

// Import version tracking
let logVersionInfo: any = () => {};
let checkVersionAndClearCache: any = () => false;
let getShortVersion: any = () => 'v1.0.0';
try {
  const versionModule = require("@/lib/version");
  logVersionInfo = versionModule.logVersionInfo;
  checkVersionAndClearCache = versionModule.checkVersionAndClearCache;
  getShortVersion = versionModule.getShortVersion;
} catch {
  // Version module not available
}

// Import chunk error handler with fallback
let useChunkErrorHandler: any = () => {};
try {
  const chunkModule = require("@/components/chunk-error-boundary");
  useChunkErrorHandler = chunkModule.useChunkErrorHandler;
} catch (chunkError) {
  console.error('Failed to load chunk error handler:', chunkError);
}

export default function RunSmartApp() {
  const [currentScreen, setCurrentScreen] = useState<string>("onboarding")
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [safeMode, setSafeMode] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Ref to prevent double initialization in React Strict Mode
  const initRef = useRef(false)

  // Call chunk error handler hook unconditionally (hooks must be called at top level)
  useChunkErrorHandler()

  console.log('🚀 RunSmartApp component rendering...')

  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initRef.current) {
      console.log('🔍 Skipping duplicate initialization (React Strict Mode)')
      return
    }
    initRef.current = true
    
    console.log('🔍 RunSmartApp useEffect running...')
    
    // Global error handler
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      setErrorMessage(event.error?.message || 'Unknown error occurred');
      setHasError(true);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      setErrorMessage(event.reason?.message || 'Promise rejection occurred');
      setHasError(true);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Check for special URL parameters
    try {
      if (typeof window !== 'undefined') {
        const usp = new URLSearchParams(window.location.search)

        // Reset mode: add ?reset=1 to URL to clear all data and restart onboarding
        if (usp.get('reset') === '1') {
          console.warn('[app:reset] Reset mode enabled via ?reset=1 - clearing all data')

          // Import resetDatabaseInstance to close connection (use .then() since we're not in async function)
          import('@/lib/db').then((dbModule) => {
            if (dbModule.resetDatabaseInstance) {
              dbModule.resetDatabaseInstance()
              console.log('[app:reset] ✅ Database connection closed')
            }
          }).catch((err) => {
            console.warn('[app:reset] Failed to close database connection:', err)
          })

          // Clear localStorage COMPLETELY
          localStorage.clear()
          console.log('[app:reset] ✅ localStorage cleared')

          // Clear IndexedDB (connection now closed, will succeed)
          indexedDB.deleteDatabase('running-coach-db')
          console.log('[app:reset] ✅ Database deletion initiated: running-coach-db')

          // Set a flag to force onboarding after reset
          sessionStorage.setItem('force-onboarding', 'true')
          console.log('[app:reset] ✅ Force onboarding flag set')

          // Remove ?reset=1 from URL and reload
          window.history.replaceState({}, '', window.location.pathname)

          // Delay reload to ensure database deletion completes
          setTimeout(() => {
            console.log('[app:reset] ✅ Reloading page with clean state...')
            window.location.reload()
          }, 300)
          return
        }

        // Safe mode to bypass dynamic imports if needed: add ?safe=1 to URL
        if (usp.get('safe') === '1') {
          console.warn('[app:safe] Safe mode enabled via ?safe=1')
          setSafeMode(true)
          setIsLoading(false)
          return
        }
      }
    } catch (safeCheckError) {
      console.warn('Safe mode check failed:', safeCheckError);
    }
    
    // Initialize app state with enhanced error handling and production resilience
    const initializeApp = async () => {
      const initStartTime = performance.now();
      
      if (typeof window !== 'undefined') {
        try {
          // Log version info first thing
          logVersionInfo();
          
          // Check for version changes and clear stale cache
          const versionChanged = checkVersionAndClearCache();
          if (versionChanged) {
            console.log('[app:init:version] Version changed - cache cleared');
          }
          
          console.log('[app:init:start] Starting enhanced application initialization...')
          logDiagnostic('database', 'App initialization started');

          // Check for force-onboarding flag (set after reset)
          const forceOnboarding = sessionStorage.getItem('force-onboarding') === 'true'
          if (forceOnboarding) {
            console.log('[app:init] 🔄 Force onboarding flag detected - showing onboarding')
            sessionStorage.removeItem('force-onboarding')
            setIsOnboardingComplete(false)
            setCurrentScreen('onboarding')
            setIsLoading(false)
            return
          }

          // Production-optimized timeouts (longer for slower connections)
          const isProduction = process.env.NODE_ENV === 'production';
          const DB_INIT_TIMEOUT = isProduction ? 10000 : 5000; // 10s in prod, 5s in dev
          const DB_RETRY_ATTEMPTS = isProduction ? 3 : 2;
          const DB_RETRY_DELAY = 1000;
          
          // Step 1: Initialize database with timeout and retries
          let dbInitSuccess = false;
          for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS && !dbInitSuccess; attempt++) {
            if (dbUtils?.initializeDatabase) {
              const dbInitTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Database init timeout (${DB_INIT_TIMEOUT/1000}s)`)), DB_INIT_TIMEOUT)
              );
              
              try {
                console.log(`[app:init:db] Attempt ${attempt}/${DB_RETRY_ATTEMPTS} - Initializing database...`)
                await Promise.race([dbUtils.initializeDatabase(), dbInitTimeout]);
                dbInitSuccess = true;
                console.log('[app:init:db] ✅ Database initialized successfully')
                logDatabaseInit(true, Math.round(performance.now() - initStartTime));
              } catch (dbError) {
                const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
                console.warn(`[app:init:db] ⚠️ Attempt ${attempt} failed:`, errorMsg);
                
                if (attempt < DB_RETRY_ATTEMPTS) {
                  console.log(`[app:init:db] Retrying in ${DB_RETRY_DELAY}ms...`);
                  await new Promise(r => setTimeout(r, DB_RETRY_DELAY * attempt));
                } else {
                  console.warn('[app:init:db] ⚠️ All database init attempts failed, continuing with fallback');
                  logDatabaseInit(false, Math.round(performance.now() - initStartTime), errorMsg);
                }
              }
            }
          }
          
          // Step 2: Perform startup migration with error handling
          if (dbInitSuccess) {
            console.log('[app:init:migration] Running startup migration...')
            try {
              const migrationSuccess = await dbUtils?.performStartupMigration?.()
              if (migrationSuccess) {
                console.log('[app:init:migration] ✅ Startup migration completed')
              } else {
                console.warn('[app:init:migration] ⚠️ Startup migration had issues (continuing)')
              }
            } catch (migrationError) {
              console.warn('[app:init:migration] ⚠️ Migration failed, continuing:', migrationError);
            }

          // Step 2.5: Seed demo routes if database initialized
          if (dbInitSuccess && seedDemoRoutes) {
            console.log('[app:init:routes] Seeding demo routes...')
            try {
              await seedDemoRoutes()
              console.log('[app:init:routes] ✅ Demo routes seeded successfully')
            } catch (routeError) {
              console.warn('[app:init:routes] ⚠️ Route seeding failed (continuing):', routeError);
            }
          }
          }
          
          // Step 3: Ensure user is ready with enhanced fallback
          console.log('[app:init:user] Ensuring user identity is ready...')
          let userResolved = false;
          
          if (dbInitSuccess) {
            try {
              const readyUser = await dbUtils?.ensureUserReady?.()
              if (readyUser) {
                console.log(`[app:init:user] ✅ User ready: id=${readyUser.id}, onboarding=${readyUser.onboardingComplete}`)
                
                if (readyUser.onboardingComplete) {
                  setIsOnboardingComplete(true)
                  setCurrentScreen("today")
                  localStorage.setItem("onboarding-complete", "true")
                  console.log('[app:init:nav] ✅ User ready - navigating to today screen')
                  logNavigation('init', 'today', 'User onboarding complete');
                } else {
                  setIsOnboardingComplete(false)
                  console.log('[app:init:nav] 📝 User needs onboarding - showing onboarding screen')
                  logNavigation('init', 'onboarding', 'User needs onboarding');
                }
                userResolved = true;
              }
            } catch (userError) {
              console.warn('[app:init:user] ⚠️ User ready check failed:', userError);
              logError('User resolution failed', userError instanceof Error ? userError : String(userError));
            }
          }
          
          // Step 4: Minimal fallback if database failed completely
          if (!userResolved) {
            console.log('[app:init:fallback] Database failed - defaulting to onboarding');
            // When database fails, ALWAYS show onboarding to be safe
            // User can complete onboarding again to recreate their data
            setIsOnboardingComplete(false)
            setCurrentScreen('onboarding')
            logNavigation('init', 'onboarding', 'Database failed - default to onboarding');
          }
          
        } catch (initErr) {
          console.error('[app:init:error] ❌ Enhanced initialization failed:', initErr)
          logError('App initialization failed', initErr instanceof Error ? initErr : String(initErr));
          
          const errorMessage = initErr instanceof Error ? initErr.message : 'Initialization failed';
          setErrorMessage(errorMessage);
          setHasError(true);
          
          // Final fallback - just show onboarding
          setIsOnboardingComplete(false);
        }
      } else {
        console.log('[app:init:ssr] 📝 Server-side render, showing onboarding')
        setIsOnboardingComplete(false)
      }
      
      // CRITICAL: Always set loading to false
      const totalInitTime = Math.round(performance.now() - initStartTime);
      console.log(`[app:init:complete] ✅ App initialization complete in ${totalInitTime}ms`)
      logDiagnostic('database', `App initialization complete`, { duration: totalInitTime });
      setIsLoading(false)
    }

    initializeApp()

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [])

  // Separate useEffect for event listeners to avoid SSR issues
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return

    console.log('🔗 Adding navigation event listeners...')

    const handleNavigateToRecord = () => {
      console.log('🎯 Navigating to record screen')
      setCurrentScreen("record")
    }

    const handleNavigateToChat = () => {
      console.log('💬 Navigating to chat screen')
      setCurrentScreen("chat")
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        setShowDebugPanel(prev => !prev)
      }
    }

    window.addEventListener("navigate-to-record", handleNavigateToRecord)
    window.addEventListener("navigate-to-chat", handleNavigateToChat)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      console.log('🧹 Cleaning up navigation event listeners...')
      window.removeEventListener("navigate-to-record", handleNavigateToRecord)
      window.removeEventListener("navigate-to-chat", handleNavigateToChat)
      window.removeEventListener("keydown", handleKeyDown)
      initRef.current = false
    }
  }, []) // Empty dependency array - event listeners should only be set up once

  const handleOnboardingComplete = async (userData?: any) => {
    console.log('✅ Onboarding completed by user with data:', userData)

    // Trust the atomic operation - no verification needed
    // completeOnboardingAtomic() already created user + plan
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

    console.log('✅ Onboarding complete - Navigating to Today screen')
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

  // Enhanced error display
  if (hasError) {
    console.log('⚠️ Showing error state')
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Error</h2>
          <p className="text-gray-600 mb-4">Something went wrong loading the application.</p>
          {errorMessage && (
            <details className="mb-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">Error Details</summary>
              <pre className="text-xs bg-gray-100 p-3 mt-2 rounded border overflow-auto">{errorMessage}</pre>
            </details>
          )}
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Reload Application
            </button>
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set('safe', '1');
                window.location.href = url.toString();
              }}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Load in Safe Mode
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderScreen = () => {
    try {
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
        case "chat":
          return <ChatScreen />
        case "profile":
          return <ProfileScreen />
        default:
          return <TodayScreen />
      }
    } catch (renderError) {
      console.error('Screen rendering error:', renderError);
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Screen Loading Error</h2>
          <p className="mb-4">Failed to load the requested screen: {currentScreen}</p>
          <button
            onClick={() => setCurrentScreen("today")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Today Screen
          </button>
        </div>
      );
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
