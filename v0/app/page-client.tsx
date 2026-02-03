'use client';

	import { useState, useEffect, useRef } from "react"
	import { flushSync } from "react-dom"
	import dynamic from 'next/dynamic'
	import { DATABASE } from '@/lib/constants'
	import { logger } from '@/lib/logger';
	import { WelcomeModal } from '@/components/auth/welcome-modal';
	import { SyncService } from '@/lib/sync/sync-service';
	import { useAuth } from '@/lib/auth-context';
import { RunRecoveryModal } from '@/components/run-recovery-modal';
import { RecordingCheckpointService } from '@/lib/recording-checkpoint';
import type { ActiveRecordingSession } from '@/lib/db';

type MainScreen = 'today' | 'plan' | 'record' | 'chat' | 'profile' | 'run-report'

const MAIN_SCREENS: ReadonlySet<MainScreen> = new Set(['today', 'plan', 'record', 'chat', 'profile', 'run-report'])

function parseMainScreen(value: string | null | undefined): MainScreen | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return MAIN_SCREENS.has(normalized as MainScreen) ? (normalized as MainScreen) : null
}

function getRequestedMainScreen(): MainScreen | null {
  if (typeof window === 'undefined') return null

  try {
    const usp = new URLSearchParams(window.location.search)
    const fromQuery = parseMainScreen(usp.get('screen'))
    if (fromQuery) return fromQuery
  } catch {
    // ignore
  }

  try {
    const fromHash = parseMainScreen(window.location.hash.replace(/^#/, ''))
    if (fromHash) return fromHash
  } catch {
    // ignore
  }

  try {
    const pathSegment = window.location.pathname.split('/').filter(Boolean)[0] ?? null
    const fromPath = parseMainScreen(pathSegment)
    if (fromPath) return fromPath
  } catch {
    // ignore
  }

  try {
    const fromSession = parseMainScreen(sessionStorage.getItem('last-screen'))
    if (fromSession) return fromSession
  } catch {
    // ignore
  }

  return null
}

function parseRunId(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getRequestedRunId(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const usp = new URLSearchParams(window.location.search)
    return parseRunId(usp.get('runId'))
  } catch {
    return null
  }
}

// Safer dynamic imports with comprehensive error handling
const OnboardingScreen = dynamic(
  () => import("@/components/onboarding-screen").then((module) => {
    logger.log('📦 OnboardingScreen module loaded:', { exports: Object.keys(module) });
    if (!module.OnboardingScreen) {
      throw new Error(`OnboardingScreen export not found. Available: ${Object.keys(module).join(', ')}`);
    }
    return { default: module.OnboardingScreen };
  }).catch((error) => {
    logger.error('💥 Failed to load OnboardingScreen:', error);
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
    logger.log('📦 TodayScreen module loaded:', { exports: Object.keys(module) });
    if (!module.TodayScreen) {
      throw new Error(`TodayScreen export not found. Available: ${Object.keys(module).join(', ')}`);
    }
    return { default: module.TodayScreen };
  }).catch((error) => {
    logger.error('💥 Failed to load TodayScreen:', error);
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
const RunReportScreen = dynamic(() => import("@/components/run-report-screen").then(m => ({ default: m.RunReportScreen })), { ssr: false })
const ChatScreen = dynamic(
  () => import("@/components/chat-screen")
    .then((module) => {
      logger.log('✅ ChatScreen module loaded:', { exports: Object.keys(module) });
      if (!module.ChatScreen) {
        throw new Error(`ChatScreen export not found. Available: ${Object.keys(module).join(', ')}`);
      }
      return { default: module.ChatScreen };
    })
    .catch((error) => {
      logger.error('❌ Failed to load ChatScreen:', error);
      return {
        default: () => (
          <div className="p-6 text-center space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Chat unavailable</h2>
            <p className="text-sm text-gray-600">
              We couldn&apos;t load the chat interface. Please retry from the Coach tab or refresh the app.
            </p>
          </div>
        )
      };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
      </div>
    )
  }
)
const ProfessionalLandingScreen = dynamic(
  () => import("@/components/professional-landing-screen").then(m => ({ default: m.ProfessionalLandingScreen })),
  {
    ssr: false,
    loading: () => <div className="p-6 flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div></div>
  }
)
const ProfileScreen = dynamic(
  () =>
    import("@/components/profile-screen")
      .then((module) => {
        logger.log('[ProfileScreen] module loaded:', { exports: Object.keys(module) })
        if (!module.ProfileScreen) {
          throw new Error(`ProfileScreen export not found. Available: ${Object.keys(module).join(', ')}`)
        }
        return { default: module.ProfileScreen }
      })
      .catch((error) => {
        logger.error('[ProfileScreen] Failed to load:', error)
        return {
          default: () => (
            <div className="p-6 text-center space-y-3">
              <h2 className="text-xl font-semibold text-gray-900">Profile unavailable</h2>
              <p className="text-sm text-gray-600">
                We couldn&apos;t load the Profile screen. This can happen after an update. Try refreshing the app.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Refresh
              </button>
              <details className="text-left">
                <summary className="cursor-pointer text-sm text-gray-600">Error Details</summary>
                <pre className="text-xs bg-gray-100 p-2 mt-2 rounded overflow-auto">{error.message}</pre>
              </details>
            </div>
          ),
        }
      }),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
      </div>
    ),
  },
)
const BottomNavigation = dynamic(() => import("@/components/bottom-navigation").then(m => ({ default: m.BottomNavigation })), { ssr: false })
const OnboardingDebugPanel = dynamic(() => import("@/components/onboarding-debug-panel").then(m => ({ default: m.OnboardingDebugPanel })), { ssr: false })

export default function RunSmartApp() {
  const [mounted, setMounted] = useState(false) // Fix hydration by rendering only after mount
  const [currentScreen, setCurrentScreen] = useState<string>("onboarding")
  const [runReportId, setRunReportId] = useState<number | null>(null)
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [isBetaSignupComplete, setIsBetaSignupComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true) // Start with loading=true
  const [hasError, setHasError] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [safeMode, setSafeMode] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [incompleteRecording, setIncompleteRecording] = useState<ActiveRecordingSession | null>(null)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)

  // Ref to prevent double initialization in React Strict Mode
  const initRef = useRef(false)

  // Ref to store dynamically loaded modules
  const dbUtilsRef = useRef<any>(null)

  // Get auth context for sync
  const { user, profileId } = useAuth()


  logger.log('🚀 RunSmartApp component rendering...', { isLoading, isOnboardingComplete })

  // Set mounted state to fix hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize app - load user and check onboarding status
  useEffect(() => {
    logger.log('🔍 [INIT] useEffect triggered, mounted=', mounted)
    if (!mounted) {
      logger.log('🔍 [INIT] Not mounted yet, returning early')
      return
    }
    
    logger.log('🔍 [INIT] Mounted! Starting initialization...')

    const requestedMainScreen = getRequestedMainScreen()
    const requestedRunId = requestedMainScreen === 'run-report' ? getRequestedRunId() : null
    if (requestedRunId) {
      setRunReportId(requestedRunId)
    }

    // Prevent double initialization in React Strict Mode
    if (initRef.current) {
      logger.log('🔍 [INIT] Already initialized (initRef=true), skipping')
      return
    }
    initRef.current = true
    logger.log('🔍 [INIT] initRef set to true, proceeding with initialization')

    // CRITICAL SAFETY: Set a maximum timeout for initialization
    const safetyTimeout = setTimeout(() => {
      logger.warn('⚠️ SAFETY TIMEOUT: Forcing initialization complete')
      
      // Check localStorage before forcing state
      const localComplete = localStorage.getItem('onboarding-complete') === 'true';
      const localUserData = localStorage.getItem('user-data');
      
      if (localComplete && localUserData) {
        logger.log('[app:safety] ✅ Restoring from localStorage on timeout');
        setIsOnboardingComplete(true);
        setCurrentScreen(requestedMainScreen ?? 'today');
      }
      
      setIsLoading(false)
    }, 3000) // 3 second maximum

    // Global error handler
    const handleGlobalError = (event: ErrorEvent) => {
      logger.error('Global error caught:', event.error);
      setErrorMessage(event.error?.message || 'Unknown error occurred');
      setHasError(true);
      setIsLoading(false); // Ensure loading clears on error
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection:', event.reason);
      setErrorMessage(event.reason?.message || 'Promise rejection occurred');
      setHasError(true);
      setIsLoading(false); // Ensure loading clears on error
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Check for special URL parameters
    try {
      if (typeof window !== 'undefined') {
        const usp = new URLSearchParams(window.location.search)

        // Reset mode: add ?reset=1 to URL to clear all data and restart onboarding
        if (usp.get('reset') === '1') {
          logger.warn('[app:reset] Reset mode enabled via ?reset=1 - clearing all data')

          // Import resetDatabaseInstance to close connection (use .then() since we're not in async function)
          import('@/lib/db').then((dbModule) => {
            if (dbModule.resetDatabaseInstance) {
              dbModule.resetDatabaseInstance()
              logger.log('[app:reset] ✅ Database connection closed')
            }
          }).catch((err) => {
            logger.warn('[app:reset] Failed to close database connection:', err)
          })

          // Clear localStorage COMPLETELY
          localStorage.clear()
          logger.log('[app:reset] ✅ localStorage cleared')

          // Clear IndexedDB (connection now closed, will succeed)
          const dbNamesToDelete = [DATABASE.NAME, 'running-coach-db', 'RunningCoachDB']
          dbNamesToDelete.forEach((dbName) => {
            try {
              indexedDB.deleteDatabase(dbName)
              logger.log(`[app:reset] ✅ Database deletion initiated: ${dbName}`)
            } catch (error) {
              logger.warn(`[app:reset] Failed to delete database ${dbName}:`, error)
            }
          })

          // Set a flag to force onboarding after reset
          sessionStorage.setItem('force-onboarding', 'true')
          logger.log('[app:reset] ✅ Force onboarding flag set')

          // Remove ?reset=1 from URL and reload
          window.history.replaceState({}, '', window.location.pathname)

          // Delay reload to ensure database deletion completes
          setTimeout(() => {
            logger.log('[app:reset] ✅ Reloading page with clean state...')
            window.location.reload()
          }, 300)
          return
        }

        // Safe mode to bypass dynamic imports if needed: add ?safe=1 to URL
        if (usp.get('safe') === '1') {
          logger.warn('[app:safe] Safe mode enabled via ?safe=1')
          setSafeMode(true)
          setIsLoading(false)
          return
        }
      }
    } catch (safeCheckError) {
      logger.warn('Safe mode check failed:', safeCheckError);
    }
    
    // Initialize app state with enhanced error handling and production resilience
    const initializeApp = async () => {
      if (typeof window !== 'undefined') {
        try {
          logger.log('[app:init:start] Starting application initialization...');

          // Check if beta signup has been completed
          const betaSignupEmail = localStorage.getItem('beta_signup_email');
          const betaSignupComplete = localStorage.getItem('beta_signup_complete') === 'true';
          const preselectedChallenge = localStorage.getItem('preselectedChallenge');
          const hasBetaSignup = Boolean(betaSignupEmail || betaSignupComplete || preselectedChallenge);

          if (hasBetaSignup) {
            logger.log('[app:init:beta] ✅ Beta signup already completed:', {
              email: betaSignupEmail,
              betaSignupComplete,
              preselectedChallenge
            });
            setIsBetaSignupComplete(true);
          } else {
            logger.log('[app:init:beta] ⚠️ Beta signup not completed yet');
            setIsBetaSignupComplete(false);
          }

          // Dynamically load database utilities
          if (!dbUtilsRef.current) {
            const dbUtilsModule = await import("@/lib/dbUtils");
            dbUtilsRef.current = dbUtilsModule.dbUtils ?? dbUtilsModule.default ?? dbUtilsModule;
            logger.log('[app:init:modules] ✅ Database utilities loaded');
          }

          const dbUtils = dbUtilsRef.current;
          
          await dbUtils.initializeDatabase();
          logger.log('[app:init:db] ✅ Database initialized successfully');

          // Seed challenge templates on first launch
          try {
            await dbUtils.seedChallengeTemplates();
            logger.log('[app:init:challenges] ✅ Challenge templates seeded');
          } catch (challengeError) {
            logger.warn('[app:init:challenges] Failed to seed challenge templates:', challengeError);
            // Non-fatal error, continue initialization
          }

          await dbUtils.performStartupMigration();
          logger.log('[app:init:migration] ✅ Startup migration completed');

          const user = await dbUtils.ensureUserReady();
          if (user) {
            logger.log(`[app:init:user] ✅ User ready: id=${user.id}, onboarding=${user.onboardingComplete}`);
            if (user.id) {
              try {
                const { syncUserRunData } = await import("@/lib/run-recording");
                const syncResult = await syncUserRunData(user.id);
                logger.log("[app:init:sync] ✅ Run data synchronized", syncResult);
              } catch (syncError) {
                logger.warn("[app:init:sync] ⚠️ Failed to sync run data:", syncError);
              }

              // Check for incomplete recording session
              try {
                const checkpointService = new RecordingCheckpointService(user.id);
                const incompleteSession = await checkpointService.getIncompleteSession(user.id);
                if (incompleteSession) {
                  logger.log("[app:init:recovery] ⚠️ Found incomplete recording session", {
                    sessionId: incompleteSession.id,
                    startedAt: incompleteSession.startedAt,
                    distanceKm: incompleteSession.distanceKm,
                    durationSeconds: incompleteSession.durationSeconds,
                  });
                  setIncompleteRecording(incompleteSession);
                  setShowRecoveryModal(true);
                } else {
                  logger.log("[app:init:recovery] ✅ No incomplete recording sessions found");
                }
              } catch (recoveryError) {
                logger.warn("[app:init:recovery] ⚠️ Failed to check for incomplete recordings:", recoveryError);
              }
            }
            if (user.onboardingComplete) {
              setIsOnboardingComplete(true);
              setCurrentScreen(requestedMainScreen ?? "today");
              // SYNC: Ensure localStorage matches database state
              localStorage.setItem('onboarding-complete', 'true');
              localStorage.setItem('user-data', JSON.stringify({
                id: user.id,
                experience: user.experience,
                goal: user.goal,
                daysPerWeek: user.daysPerWeek,
                preferredTimes: user.preferredTimes,
              }));
              logger.log('[app:init:sync] ✅ localStorage synced with database');
            } else {
              setIsOnboardingComplete(false);
              setCurrentScreen("onboarding");
              // Clear localStorage if onboarding not complete
              localStorage.removeItem('onboarding-complete');
              logger.log('[app:init:sync] ⚠️ Onboarding incomplete, localStorage cleared');
            }
          } else {
            throw new Error('Failed to ensure user is ready');
          }
        } catch (initErr: any) {
          logger.error('[app:init:error] ❌ Initialization failed:', initErr);
          setErrorMessage(initErr.message || 'Initialization failed');
          setHasError(true);
          setIsOnboardingComplete(false);
        } finally {
          setIsLoading(false);
          logger.log('[app:init:complete] ✅ App initialization complete');
        }
      } else {
        logger.log('[app:init:ssr] 📝 Server-side render, showing onboarding');
        setIsOnboardingComplete(false);
        setIsLoading(false);
      }
    }

    initializeApp().finally(() => {
      clearTimeout(safetyTimeout) // Clear safety timeout if init completes normally
    })

    return () => {
      clearTimeout(safetyTimeout)
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      initRef.current = false
    };
  }, [mounted])

  // Auto-sync: Start background sync for authenticated users
  useEffect(() => {
    if (!mounted || !user || !profileId) {
      return
    }

    logger.log('[Sync] Starting auto-sync for authenticated user')
    const syncService = SyncService.getInstance()
    syncService.startAutoSync()

    // Cleanup: Stop auto-sync when component unmounts or user signs out
    return () => {
      logger.log('[Sync] Stopping auto-sync')
      syncService.stopAutoSync()
    }
  }, [mounted, user, profileId])

  // Persist active screen in URL/session so reloads return to the same tab (important for /profile deep links and chunk reloads)
  useEffect(() => {
    if (!mounted) return
    if (!isOnboardingComplete) return

    const mainScreen = parseMainScreen(currentScreen)
    if (!mainScreen) return

    try {
      sessionStorage.setItem('last-screen', mainScreen)
    } catch {
      // ignore
    }

     try {
       const url = new URL(window.location.href)
       url.searchParams.set('screen', mainScreen)
       if (mainScreen === 'run-report' && runReportId) {
         url.searchParams.set('runId', String(runReportId))
       } else {
         url.searchParams.delete('runId')
       }
       window.history.replaceState({}, '', url.toString())
     } catch {
       // ignore
     }
   }, [currentScreen, isOnboardingComplete, mounted, runReportId])

  // Separate useEffect for event listeners to avoid SSR issues
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return

    logger.log('🔗 Adding navigation event listeners...')

    const handleNavigateToRecord = () => {
      logger.log('🎯 Navigating to record screen')
      setCurrentScreen("record")
    }

    const handleNavigateToChat = () => {
      logger.log('💬 Navigating to chat screen')
      setCurrentScreen("chat")
    }

    const handleNavigateToPlan = () => {
      logger.log('Navigating to plan screen')
      setCurrentScreen("plan")
    }

    const handleNavigateToRunReport = (event: Event) => {
      const detail = (event as CustomEvent).detail as any
      const nextRunId = parseRunId(String(detail?.runId ?? ''))
      if (nextRunId) {
        setRunReportId(nextRunId)
      }
      setCurrentScreen("run-report")
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        setShowDebugPanel(prev => !prev)
      }
    }

    window.addEventListener("navigate-to-record", handleNavigateToRecord)
    window.addEventListener("navigate-to-chat", handleNavigateToChat)
    window.addEventListener("navigate-to-plan", handleNavigateToPlan)
    window.addEventListener("navigate-to-run-report", handleNavigateToRunReport as EventListener)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      logger.log('🧹 Cleaning up navigation event listeners...')
      window.removeEventListener("navigate-to-record", handleNavigateToRecord)
      window.removeEventListener("navigate-to-chat", handleNavigateToChat)
      window.removeEventListener("navigate-to-plan", handleNavigateToPlan)
      window.removeEventListener("navigate-to-run-report", handleNavigateToRunReport as EventListener)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, []) // Empty dependency array - event listeners should only be set up once

  const handleBetaSignupComplete = () => {
    logger.log('✅ [handleBetaSignupComplete] Beta signup completed')
    flushSync(() => {
      setIsBetaSignupComplete(true)
    })
    logger.log('✅ [handleBetaSignupComplete] Moving to onboarding screen')
  }

  const handleOnboardingComplete = (userData?: any) => {
    logger.log('✅ [handleOnboardingComplete] Starting navigation to Today screen...')

    const finalUserData = userData || {
      experience: 'beginner',
      goal: 'habit',
      daysPerWeek: 3,
      preferredTimes: ['morning'],
      age: 30,
    };

    try {
      // Update localStorage first
      localStorage.setItem("onboarding-complete", "true")
      localStorage.setItem("user-data", JSON.stringify(finalUserData))
      logger.log('✅ [handleOnboardingComplete] localStorage updated')

      // Use flushSync to force immediate synchronous state updates and re-render
      // This ensures navigation happens immediately without waiting for batching
      flushSync(() => {
        logger.log('✅ [handleOnboardingComplete] Setting states synchronously...')
        setIsOnboardingComplete(true)
        setCurrentScreen("today")
      })

      logger.log('✅ [handleOnboardingComplete] State updated successfully - should now show Today screen')
      logger.log('✅ [handleOnboardingComplete] Final state: isOnboardingComplete=true, currentScreen=today')
    } catch (error) {
      logger.error('❌ [handleOnboardingComplete] Error during navigation:', error)
      // Fallback: try setting states without flushSync
      setIsOnboardingComplete(true)
      setCurrentScreen("today")
    }
  }

  logger.log('🎭 Current screen:', currentScreen, 'Onboarding complete:', isOnboardingComplete, 'Loading:', isLoading, 'Error:', hasError)

  // Show consistent loading state to prevent hydration mismatch
  if (!mounted || isLoading) {
    if (isLoading) {
      logger.log('⏳ Showing loading state...')
    }
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
    logger.log('⚠️ Showing error state')
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
      // Show professional landing screen if beta signup not completed
      if (!isBetaSignupComplete) {
        logger.log('🎯 Rendering professional landing screen - isBetaSignupComplete:', isBetaSignupComplete);
        return (
          <ProfessionalLandingScreen onContinue={handleBetaSignupComplete} />
        )
      }

      // Always show onboarding if not completed, regardless of currentScreen
      if (!isOnboardingComplete) {
        logger.log('🎓 Rendering onboarding screen - isOnboardingComplete:', isOnboardingComplete);
        logger.log('🎓 Attempted to show screen:', currentScreen);
        logger.warn('⚠️ REDIRECT TO ONBOARDING: User has not completed onboarding yet!');
        logger.warn('⚠️ To fix: Visit http://localhost:3000/debug-onboarding to check database state');
        return (
          <OnboardingScreen
            onComplete={handleOnboardingComplete}
          />
        )
      }

      logger.log('📱 Rendering main app with screen:', currentScreen, '| isOnboardingComplete:', isOnboardingComplete)
      
       switch (currentScreen) {
         case "today":
           return <TodayScreen />
         case "plan":
           return <PlanScreen />
         case "record":
           return <RecordScreen />
         case "run-report":
           return (
             <RunReportScreen
               runId={runReportId}
               onBack={() => {
                 setRunReportId(null)
                 setCurrentScreen("today")
               }}
             />
           )
         case "chat":
           return <ChatScreen />
         case "profile":
           return <ProfileScreen />
         default:
           return <TodayScreen />
       }
    } catch (renderError) {
      logger.error('Screen rendering error:', renderError);
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

  // Recovery modal handlers
  const handleResumeRecording = async () => {
    if (!incompleteRecording) return;

    try {
      // Parse GPS data
      const gpsPath = JSON.parse(incompleteRecording.gpsPath);
      const lastRecordedPoint = incompleteRecording.lastRecordedPoint
        ? JSON.parse(incompleteRecording.lastRecordedPoint)
        : null;

      // Store recovery data in sessionStorage for RecordScreen to pick up
      sessionStorage.setItem('recording_recovery', JSON.stringify({
        sessionId: incompleteRecording.id,
        gpsPath,
        lastRecordedPoint,
        distanceKm: incompleteRecording.distanceKm,
        elapsedRunMs: incompleteRecording.elapsedRunMs,
        workoutId: incompleteRecording.workoutId,
        routeId: incompleteRecording.routeId,
        autoPauseCount: incompleteRecording.autoPauseCount,
        acceptedPointCount: incompleteRecording.acceptedPointCount,
        rejectedPointCount: incompleteRecording.rejectedPointCount,
      }));

      logger.log('[app:recovery] ✅ Recovery data stored in sessionStorage');

      // Navigate to record screen
      setShowRecoveryModal(false);
      setCurrentScreen('record');
      setIncompleteRecording(null);
    } catch (err) {
      logger.error('[app:recovery] ❌ Failed to prepare recovery:', err);
    }
  };

  const handleDiscardRecording = async () => {
    if (!incompleteRecording || !incompleteRecording.id) return;

    try {
      const checkpointService = new RecordingCheckpointService(incompleteRecording.userId);
      await checkpointService.clearCheckpoint(incompleteRecording.id);

      logger.log('[app:recovery] ✅ Recording discarded successfully');

      setShowRecoveryModal(false);
      setIncompleteRecording(null);
    } catch (err) {
      logger.error('[app:recovery] ❌ Failed to discard recording:', err);
    }
  };

  // Beta landing and onboarding should render without wrapper
  if (!isBetaSignupComplete || !isOnboardingComplete) {
    return renderScreen()
  }

  // Main app with wrapper and navigation
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-cyan-50/30 max-w-md mx-auto relative">
      <div className="pb-20">{renderScreen()}</div>
      <BottomNavigation currentScreen={currentScreen} onScreenChange={setCurrentScreen} />

      {/* Welcome Modal for existing users */}
      <WelcomeModal />

      {/* Recovery Modal for incomplete recordings */}
      {incompleteRecording && (
        <RunRecoveryModal
          session={incompleteRecording}
          onResume={handleResumeRecording}
          onDiscard={handleDiscardRecording}
          isOpen={showRecoveryModal}
        />
      )}

      {/* Debug Panel - Access with Ctrl+Shift+D */}
      <OnboardingDebugPanel
        isOpen={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
      />
    </div>
  )
}
