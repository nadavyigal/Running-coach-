'use client';

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Settings,
  Footprints,
  Music,
  Heart,
  Plus,
  UserCheckIcon as UserEdit,
  Bell,
  Shield,
  HelpCircle,
  Loader2,
  AlertCircle,
  Trash2,
  Database,
  Pencil,
  Brain,
  Users,
  Target,
  GitMerge,
  Star,
} from "lucide-react"
import { AddShoesModal } from "@/components/add-shoes-modal"
import { CoachingPreferencesSettings } from "@/components/coaching-preferences-settings";
import { JoinCohortModal } from "@/components/join-cohort-modal";
import { PlanTemplateFlow } from "@/components/plan-template-flow";
import { startChallengeAndSyncPlan } from "@/lib/challenge-plan-sync";
import { ProfileHeroCard } from "@/components/profile/ProfileHeroCard";
import { PrimaryGoalCard } from "@/components/profile/PrimaryGoalCard";
import { MomentumSnapshotGrid } from "@/components/profile/MomentumSnapshotGrid";
import { ChallengeSection } from "@/components/profile/ChallengeSection";
import { CoachingProfilePanel } from "@/components/profile/CoachingProfilePanel";
import { PerformanceAnalyticsSection } from "@/components/profile/PerformanceAnalyticsSection";
import { AchievementsSection } from "@/components/profile/AchievementsSection";
import { IntegrationsListCard, type IntegrationRow } from "@/components/profile/IntegrationsListCard";
import { SettingsListCard, type SettingsRow } from "@/components/profile/SettingsListCard";
import { DeveloperToolsAccordion } from "@/components/profile/DeveloperToolsAccordion";
import { ProfilePageSkeleton } from "@/components/profile/ProfilePageSkeleton";
import { ProfileEmptyState } from "@/components/profile/ProfileEmptyStates";
import { ReminderSettings } from "@/components/reminder-settings"
import { RunSmartBrandMark } from "@/components/run-smart-brand-mark";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { UserDataSettings } from "@/components/user-data-settings";
import { useData } from "@/contexts/DataContext";
import { trackFeatureUsed, trackScreenViewed } from "@/lib/analytics";
import { getChallengeHistory, getActiveChallenge, type DailyChallengeData } from "@/lib/challengeEngine";
import { getActiveChallengeTemplates } from "@/lib/challengeTemplates";
import { DATABASE } from "@/lib/constants";
import { type Goal, type Run, db } from "@/lib/db";
import type { ChallengeProgress, ChallengeTemplate } from "@/lib/db";
import { dbUtils } from "@/lib/dbUtils";
import { GoalProgressEngine, type GoalProgress } from "@/lib/goalProgressEngine";
import { isSafeRedirect } from "@/lib/validateRedirect"

type ChallengeTemplateSeed = ReturnType<typeof getActiveChallengeTemplates>[number]

export function ProfileScreen() {
  const router = useRouter()
  const recentRunsWindowDays = 14
  const hasTrackedProfileViewRef = useRef(false)

  // Get shared data from context
  const {
    user,
    userId: contextUserId,
    primaryGoal: contextPrimaryGoal,
    activeGoals,
    recentRuns: contextRecentRuns,
    allTimeStats,
    refresh: refreshContext,
  } = useData()

  // Add state for the shoes modal at the top of the component
  const [showAddShoesModal, setShowAddShoesModal] = useState(false)
  const [runningShoes, setRunningShoes] = useState<any[]>([])
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [showJoinCohortModal, setShowJoinCohortModal] = useState(false);
  const [showCoachingPreferences, setShowCoachingPreferences] = useState(false);
  const [showPlanTemplateFlow, setShowPlanTemplateFlow] = useState(false);
  const [showUserDataModal, setShowUserDataModal] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null);
  const [recentRuns, setRecentRuns] = useState<Run[]>([])
  const [isRunsLoading, setIsRunsLoading] = useState(false)
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [goalProgressMap, setGoalProgressMap] = useState<Map<number, GoalProgress>>(new Map())
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [challengeHistory, setChallengeHistory] = useState<Array<{ progress: ChallengeProgress; template: ChallengeTemplate }>>([])
  const [isChallengesLoading, setIsChallengesLoading] = useState(false)
  const [activeChallenge, setActiveChallenge] = useState<{ progress: ChallengeProgress; template: ChallengeTemplate; dailyData: DailyChallengeData } | null>(null)
  const [mergeSourceGoal, setMergeSourceGoal] = useState<Goal | null>(null)
  const [isSwitchingPrimary, setIsSwitchingPrimary] = useState(false)
  const [joiningChallengeSlug, setJoiningChallengeSlug] = useState<string | null>(null)
  const [garminConnected, setGarminConnected] = useState(false)

  const filterRunsToRecentWindow = useCallback((runs: Run[]): Run[] => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - recentRunsWindowDays)
    cutoff.setHours(0, 0, 0, 0)

    return runs
      .filter((run) => {
        const runDate = new Date(run.completedAt ?? run.createdAt)
        return runDate >= cutoff
      })
      .sort(
        (a, b) =>
          new Date(b.completedAt ?? b.createdAt).getTime() -
          new Date(a.completedAt ?? a.createdAt).getTime()
      )
  }, [recentRunsWindowDays])

  // Sync from context
  useEffect(() => {
    if (contextUserId) setUserId(contextUserId)
    if (contextPrimaryGoal) setPrimaryGoal(contextPrimaryGoal)
    if (activeGoals.length > 0) setGoals(activeGoals)
    setRecentRuns(filterRunsToRecentWindow(contextRecentRuns))
  }, [contextUserId, contextPrimaryGoal, activeGoals, contextRecentRuns, filterRunsToRecentWindow])

  // Load Garmin connection status
  useEffect(() => {
    if (!userId) return
    let mounted = true
    void db.wearableDevices
      .where('[userId+type]' as any)
      .equals([userId, 'garmin'])
      .first()
      .then((device) => {
        if (mounted) setGarminConnected(!!device && device.connectionStatus !== 'disconnected')
      })
      .catch(() => { /* ignore */ })
    return () => { mounted = false }
  }, [userId])

  // Load goal progress using GoalProgressEngine for consistency with GoalProgressDashboard
  useEffect(() => {
    const loadGoalProgress = async () => {
      if (goals.length === 0) return

      const engine = new GoalProgressEngine()
      const progressMap = new Map<number, GoalProgress>()

      for (const goal of goals) {
        if (goal.id) {
          try {
            const progress = await engine.calculateGoalProgress(goal.id)
            if (progress) {
              progressMap.set(goal.id, progress)
            }
          } catch (err) {
            console.error(`Error calculating progress for goal ${goal.id}:`, err)
          }
        }
      }

      setGoalProgressMap(progressMap)
    }

    loadGoalProgress()
  }, [goals])

  const loadChallengeData = useCallback(async () => {
    if (!userId) {
      setChallengeHistory([])
      setActiveChallenge(null)
      return
    }

    setIsChallengesLoading(true)
    try {
      // Load active challenge
      const active = await getActiveChallenge(userId)
      setActiveChallenge(active)

      // Load challenge history (filter out active challenge to avoid duplication)
      const history = await getChallengeHistory(userId)
      // Only show completed/abandoned challenges in history
      const filteredHistory = history.filter(ch => ch.progress.status !== 'active')
      setChallengeHistory(filteredHistory)
    } catch (error) {
      console.error("Error loading challenge data:", error)
      setChallengeHistory([])
      setActiveChallenge(null)
    } finally {
      setIsChallengesLoading(false)
    }
  }, [userId])

  // Load challenge history and active challenge
  useEffect(() => {
    void loadChallengeData()
  }, [loadChallengeData])

  const availableChallenges = getActiveChallengeTemplates()

  // Helper to get progress for a goal (uses engine-calculated progress)
  const getGoalProgress = (goalId?: number): number => {
    if (!goalId) return 0
    const progress = goalProgressMap.get(goalId)
    return progress?.progressPercentage ?? 0
  }

  // Helper to get trajectory for a goal
  const getGoalTrajectory = (goalId?: number): string | null => {
    if (!goalId) return null
    const progress = goalProgressMap.get(goalId)
    return progress?.trajectory ?? null
  }

  const handleGarminConnect = async () => {
    if (!userId) return
    try {
      const response = await fetch('/api/devices/garmin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ userId, redirectUri: `${window.location.origin}/garmin/callback` }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success || !data?.authUrl) {
        throw new Error(data?.error || 'Failed to initiate Garmin connection')
      }
      if (!isSafeRedirect(data.authUrl)) {
        throw new Error('Blocked unsafe redirect URL')
      }
      window.location.href = data.authUrl
    } catch (err) {
      console.error('Garmin connect failed:', err)
      toast({ title: 'Connection failed', description: 'Could not start Garmin connection. Please try again.', variant: 'destructive' })
    }
  }

  const handleDeleteGoal = async () => {
    if (!goalToDelete?.id) return;
    try {
      await dbUtils.deleteGoal(goalToDelete.id);
      // Update local state
      setGoals(prev => prev.filter(g => g.id !== goalToDelete.id));
      if (primaryGoal?.id === goalToDelete.id) {
        setPrimaryGoal(null);
      }
      // Refresh context data
      refreshContext();
      toast({
        title: "Goal deleted",
        description: `"${goalToDelete.title}" has been removed.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete goal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setGoalToDelete(null);
    }
  };

  const openDeleteDialog = (goal: Goal) => {
    setGoalToDelete(goal);
    setIsDeleteDialogOpen(true);
  };

  // Handle switching primary goal
  const handleSetPrimary = async (goalId: number) => {
    if (!userId) return
    setIsSwitchingPrimary(true)
    try {
      await dbUtils.setPrimaryGoal(userId, goalId)
      await refreshContext()
      toast({
        title: "Primary goal updated",
        description: "Your primary goal has been changed.",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update primary goal. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSwitchingPrimary(false)
    }
  }

  // Handle merging goals
  const handleMergeGoal = async () => {
    if (!mergeSourceGoal?.id || !primaryGoal?.id || !userId) return
    try {
      await dbUtils.mergeGoals(userId, mergeSourceGoal.id, primaryGoal.id, {
        deleteSource: true,
        combineProgress: true,
      })
      await refreshContext()
      toast({
        title: "Goals merged",
        description: `"${mergeSourceGoal.title}" has been merged into your primary goal.`,
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to merge goals. Please try again.",
        variant: "destructive",
      })
    } finally {
      setShowMergeDialog(false)
      setMergeSourceGoal(null)
    }
  }

  const handleJoinChallenge = async (template: ChallengeTemplateSeed) => {
    if (!userId) return
    trackProfileInteraction('challenge_join_click', { challenge_slug: template.slug })
    if (activeChallenge?.template.slug === template.slug) {
      toast({
        title: "Already active",
        description: "You're already in this challenge.",
      })
      return
    }

    const hadActive = Boolean(activeChallenge)
    setJoiningChallengeSlug(template.slug)
    try {
      const activePlan = await dbUtils.ensureUserHasActivePlan(userId)
      if (!activePlan?.id) {
        throw new Error("No active plan found")
      }

      const syncResult = await startChallengeAndSyncPlan({
        userId,
        planId: activePlan.id,
        challenge: template,
      })

      await loadChallengeData()
      await refreshContext()

      toast({
        title: "Challenge started",
        description: hadActive
          ? syncResult.planUpdated
            ? `${template.name} has begun with a synced challenge plan. Your previous challenge is now in history.`
            : `${template.name} has begun. Your previous challenge is now in history, but plan sync did not complete.`
          : syncResult.planUpdated
            ? `${template.name} has begun with a synced challenge plan.`
            : `${template.name} has begun, but plan sync did not complete.`,
      })
    } catch (error) {
      console.error("Failed to start challenge:", error)
      toast({
        title: "Failed to start challenge",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setJoiningChallengeSlug(null)
    }
  }

  const openMergeDialog = (goal: Goal) => {
    setMergeSourceGoal(goal)
    setShowMergeDialog(true)
  }

  const getDaysRemaining = (goal?: Goal | null) => {
    if (!goal?.timeBound?.deadline) return null;
    const deadline = new Date(goal.timeBound.deadline);
    const deadlineTime = deadline.getTime();
    if (Number.isNaN(deadlineTime)) return null;
    const diff = Math.ceil((deadlineTime - Date.now()) / (1000 * 60 * 60 * 24));
    return diff < 0 ? 0 : diff;
  };

  const loadGoals = useCallback(async () => {
    if (!userId) return;
    try {
      const [primary, activeGoals] = await Promise.all([
        dbUtils.getPrimaryGoal(userId),
        dbUtils.getUserGoals(userId, 'active'),
      ]);
      setPrimaryGoal(primary || activeGoals[0] || null);
      setGoals(activeGoals);
    } catch (goalError) {
      console.warn('[ProfileScreen] Failed to load goals:', goalError);
    }
  }, [userId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatPace = (secondsPerKm: number) => {
    if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--:--'
    const mins = Math.floor(secondsPerKm / 60)
    const secs = Math.round(secondsPerKm % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date))
  }

  const getVDOTRating = (vdot: number): string => {
    if (vdot >= 70) return 'Elite'
    if (vdot >= 60) return 'Advanced'
    if (vdot >= 50) return 'Intermediate'
    if (vdot >= 40) return 'Novice'
    return 'Beginner'
  }

  // Add useEffect to load shoes data
  useEffect(() => {
    const shoes = JSON.parse(localStorage.getItem("running-shoes") || "[]")
    setRunningShoes(shoes)
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const loadRuns = async () => {
      setIsRunsLoading(true)
      try {
        const endDate = new Date()
        const startDate = new Date(endDate)
        startDate.setDate(endDate.getDate() - recentRunsWindowDays)
        startDate.setHours(0, 0, 0, 0)
        const runs = await dbUtils.getRunsInTimeRange(userId, startDate, endDate)
        if (!cancelled) setRecentRuns(filterRunsToRecentWindow(runs))
      } catch (err) {
        console.warn('[ProfileScreen] Failed to load runs:', err)
      } finally {
        if (!cancelled) setIsRunsLoading(false)
      }
    }

    loadRuns()

    const onRunSaved = () => {
      void loadRuns()
      void loadChallengeData()
    }
    const onGarminRunSynced = () => {
      void loadRuns()
      void loadChallengeData()
    }
    const onChallengeUpdated = () => {
      void loadChallengeData()
    }
    window.addEventListener('run-saved', onRunSaved)
    window.addEventListener('garmin-run-synced', onGarminRunSynced)
    window.addEventListener('challenge-updated', onChallengeUpdated)
    return () => {
      cancelled = true
      window.removeEventListener('run-saved', onRunSaved)
      window.removeEventListener('garmin-run-synced', onGarminRunSynced)
      window.removeEventListener('challenge-updated', onChallengeUpdated)
    }
  }, [userId, loadChallengeData, filterRunsToRecentWindow, recentRunsWindowDays])

  useEffect(() => {
    const loadUserData = async (retryCount = 0) => {
      // Production-aware settings
      const isProduction = process.env.NODE_ENV === 'production';
      const maxRetries = isProduction ? 5 : 3;
      const baseDelay = isProduction ? 1500 : 1000;

      try {
        setIsLoading(true);
        setError(null);

        console.log(`[ProfileScreen] Loading user data (attempt ${retryCount + 1}/${maxRetries})...`);

        // First, ensure database is initialized before querying
        if (retryCount === 0) {
          console.log('[ProfileScreen] Ensuring database is initialized...');
          try {
            const dbReady = await dbUtils.initializeDatabase();
            if (!dbReady) {
              console.warn('[ProfileScreen] Database initialization returned false');
            }
            // Wait a bit more in production for database to stabilize
            if (isProduction) {
              await new Promise(r => setTimeout(r, 800));
            }
          } catch (dbInitError) {
            console.warn('[ProfileScreen] Database init check failed:', dbInitError);
            // Continue anyway - might still work
          }
        } else {
          // On retry, wait with exponential backoff
          const waitTime = baseDelay * Math.pow(1.5, retryCount - 1);
          console.log(`[ProfileScreen] Waiting ${waitTime}ms before retry...`);
          await new Promise(r => setTimeout(r, waitTime));
        }

        const user = await dbUtils.getCurrentUser();

        if (user) {
          console.log(`[ProfileScreen] ג… User loaded: id=${user.id}`);
          setUserId(user.id!);
          setError(null);
          setIsLoading(false);

          // Check for new badge unlocks after streak update
          // NOTE: checkAndUnlockBadges function not yet implemented in dbUtils
          // TODO: Implement badge checking when badge engine is complete
          /*
          try {
            const unlocked = await dbUtils.checkAndUnlockBadges(user.id!);
            if (unlocked && unlocked.length > 0) {
              unlocked.forEach(badge => {
                toast({
                  title: `נ… Badge Unlocked!`,
                  description: `You earned the ${badge.type} badge for a ${badge.milestone}-day streak!`,
                });
              });
            }
          } catch (badgeError) {
            console.warn('[ProfileScreen] Badge check failed:', badgeError);
            // Don't fail the whole load for badge check
          }
          */
        } else {
          // User not found - retry with exponential backoff
          if (retryCount < maxRetries) {
            const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), 8000);
            console.log(`[ProfileScreen] User not found, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
            setTimeout(() => loadUserData(retryCount + 1), delay);
            return;
          }
          console.error('[ProfileScreen] ג All retry attempts exhausted');
          setError("Unable to load profile. The database may still be initializing. Please wait a moment and try refreshing.");
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`[ProfileScreen] Error loading user data (attempt ${retryCount + 1}):`, err);

        // Retry on error with exponential backoff
        if (retryCount < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), 8000);
          console.log(`[ProfileScreen] Retrying after error in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          setTimeout(() => loadUserData(retryCount + 1), delay);
          return;
        }

        setError("Failed to load profile data. Please try again in a few moments.");
        setIsLoading(false);
        toast({
          title: "Error",
          description: "Failed to load profile data. Please try refreshing the page.",
          variant: "destructive",
        });
      }
    };

    loadUserData();
  }, [toast]);

  // Fallback: Try to load userId directly from database if user load failed
  useEffect(() => {
    const loadUserIdFallback = async () => {
      // Only try fallback if we're not loading and don't have userId
      if (!isLoading && !userId && !error) {
        try {
          console.log('[ProfileScreen] Attempting userId fallback...');
          const { db } = await import('@/lib/db');
          const users = await db.users.toArray();
          const firstUser = users.at(0);
          if (firstUser?.id) {
            console.log(`[ProfileScreen] ג… Fallback found userId: ${firstUser.id}`);
            setUserId(firstUser.id);
            setError(null);
          }
        } catch (fallbackError) {
          console.warn('[ProfileScreen] Fallback userId load failed:', fallbackError);
        }
      }
    };

    loadUserIdFallback();
  }, [isLoading, userId, error]);

  useEffect(() => {
    if (userId) {
      void loadGoals();
    }
  }, [userId, loadGoals]);

  const trackProfileInteraction = useCallback((action: string, properties?: Record<string, unknown>) => {
    void trackFeatureUsed(`profile_${action}`, 'profile_screen', properties)
  }, [])

  useEffect(() => {
    if (isLoading || error || !userId || hasTrackedProfileViewRef.current) {
      return
    }
    hasTrackedProfileViewRef.current = true
    void trackScreenViewed('profile', undefined, { profile_version: 'v2_hub' })
  }, [error, isLoading, userId]);


  const notifyComingSoon = (name: string) => {
    trackProfileInteraction('coming_soon_click', { integration_name: name })
    toast({
      title: `${name} coming soon`,
      description: `We'll enable ${name} integration in an upcoming update.`,
    })
  }

  const resetAllData = useCallback(() => {
    trackProfileInteraction('developer_reset_all_data')
    if (!confirm('Are you sure you want to reset all app data? This cannot be undone.')) return

    [DATABASE.NAME, 'running-coach-db', 'RunningCoachDB'].forEach((dbName) => {
      try {
        indexedDB.deleteDatabase(dbName)
      } catch {
        // Best-effort cleanup
      }
    })
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }, [trackProfileInteraction])

  const sevenDayCutoff = new Date()
  sevenDayCutoff.setDate(sevenDayCutoff.getDate() - 7)
  sevenDayCutoff.setHours(0, 0, 0, 0)

  const runsLastSevenDays = recentRuns.filter((run) => {
    const completed = new Date(run.completedAt ?? run.createdAt)
    return completed >= sevenDayCutoff
  })

  const weeklyRuns = runsLastSevenDays.length
  const weeklyDistanceKm = runsLastSevenDays.reduce((sum, run) => sum + (run.distance ?? 0), 0)
  const expectedWeeklyRuns = Math.max(1, user?.daysPerWeek ?? 3)
  const consistencyScore = Math.min(100, (weeklyRuns / expectedWeeklyRuns) * 100)
  const momentumStreakDays = activeChallenge?.dailyData.streakDays ?? 0

  const distanceSparkline = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    date.setHours(0, 0, 0, 0)
    const dayStart = date.getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    const dayDistance = recentRuns.reduce((sum, run) => {
      const completed = new Date(run.completedAt ?? run.createdAt).getTime()
      if (completed >= dayStart && completed < dayEnd) {
        return sum + (run.distance ?? 0)
      }
      return sum
    }, 0)
    return Math.min(100, dayDistance * 8)
  })

  const runnerName = user?.name?.trim() || 'Runner'
  const runnerLevel = `${user?.experience ? `${String(user.experience).charAt(0).toUpperCase()}${String(user.experience).slice(1)}` : 'Beginner'} Runner`
  const runnerSummary = `You have completed ${allTimeStats.totalRuns} runs and ${allTimeStats.totalDistanceKm.toFixed(1)} km so far. ${
    weeklyRuns >= expectedWeeklyRuns ? 'You are on track this week.' : 'You are building momentum this week.'
  }`

  const goalDeadlineLabel = primaryGoal?.timeBound?.deadline
    ? (() => {
        const deadline = new Date(primaryGoal.timeBound.deadline)
        return Number.isNaN(deadline.getTime()) ? null : `Target date: ${deadline.toLocaleDateString()}`
      })()
    : null

  const primaryGoalTarget = primaryGoal?.target?.type && primaryGoal?.target?.value != null
    ? `${String(primaryGoal.target.type)} target: ${primaryGoal.target.value}`
    : undefined

  const primaryGoalProgress = getGoalProgress(primaryGoal?.id)
  const primaryGoalTrajectory = getGoalTrajectory(primaryGoal?.id)

  const coachGuidanceByTrajectory: Record<string, string> = {
    ahead: 'Excellent pace. Keep your current rhythm and recover well.',
    on_track: 'You are on track. Keep consistency and protect recovery.',
    behind: 'Add one short quality session this week to regain momentum.',
  }

  const coachGuidance = primaryGoalTrajectory
    ? (coachGuidanceByTrajectory[primaryGoalTrajectory] ?? 'Keep logging runs and we will adapt your next steps.')
    : 'Log a few more runs to unlock stronger goal guidance.'

  const integrationRows: IntegrationRow[] = [
    {
      icon: Footprints,
      name: 'Add Shoes',
      description: 'Track shoe mileage and replacement timing.',
      status: 'available',
      onClick: () => {
        trackProfileInteraction('add_shoes_open')
        setShowAddShoesModal(true)
      },
    },
    {
      icon: Users,
      name: 'Join a Cohort',
      description: 'Train with a community invite code.',
      status: 'available',
      onClick: () => {
        trackProfileInteraction('join_cohort_open')
        setShowJoinCohortModal(true)
      },
    },
    {
      icon: Music,
      name: 'Spotify',
      description: 'Sync playlists for training sessions.',
      status: 'available',
      onClick: () => notifyComingSoon('Spotify'),
    },
    {
      icon: Heart,
      name: 'Fitness Apps',
      description: 'Sync with Strava and other providers.',
      status: 'available',
      onClick: () => notifyComingSoon('Fitness app sync'),
    },
    {
      icon: Plus,
      name: 'Apple Health / Google Fit',
      description: 'Unify your health data streams.',
      status: 'available',
      onClick: () => notifyComingSoon('Health sync'),
    },
  ]

  const settingsRows: SettingsRow[] = [
    {
      icon: UserEdit,
      name: 'Edit Profile',
      description: 'Name, training profile, and preferences.',
      onClick: () => {
        trackProfileInteraction('edit_profile_open')
        setShowUserDataModal(true)
      },
    },
    {
      icon: Target,
      name: 'Goal Settings',
      description: 'Manage active goals and progression.',
      onClick: () => {
        trackProfileInteraction('goal_settings_scroll')
        document.getElementById('goal-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      },
    },
    {
      icon: Brain,
      name: 'Coaching Preferences',
      description: 'Customize AI coaching behavior.',
      onClick: () => {
        trackProfileInteraction('coaching_preferences_open')
        setShowCoachingPreferences(true)
      },
    },
    {
      icon: Bell,
      name: 'Notifications',
      description: 'Reminders and update preferences.',
      onClick: () => notifyComingSoon('Notification controls'),
    },
    {
      icon: Shield,
      name: 'Privacy & Data',
      description: 'Manage account data and exports.',
      onClick: () => {
        trackProfileInteraction('privacy_open')
        router.push('/privacy')
      },
    },
    {
      icon: HelpCircle,
      name: 'Help & Support',
      description: 'Get troubleshooting and support.',
      onClick: () => notifyComingSoon('Help center'),
    },
  ]

  const secondaryGoals = goals.filter((goal) => !primaryGoal || goal.id !== primaryGoal.id)

  return (
    <div className="space-y-5 px-4 pb-28 pt-4 md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RunSmartBrandMark compact size="lg" className="opacity-90" />
          <p className="text-label-sm text-muted-foreground">Profile Hub</p>
        </div>
        <Button variant="ghost" size="sm" aria-label="Profile screen settings">
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? <ProfilePageSkeleton /> : null}

      {error && !isLoading ? (
        <Card className="border-red-200">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-8 w-8 text-red-500" />
            <h3 className="mb-2 text-lg font-semibold">Unable to Load Profile</h3>
            <p className="mb-4 text-foreground/70">{error}</p>

            <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-[oklch(var(--surface-2))] px-3 py-2 text-xs text-foreground/60">
              <Database className="h-3 w-3" />
              <span>Database: {typeof indexedDB !== 'undefined' ? 'Available' : 'Not Available'}</span>
            </div>

            <div className="mx-auto flex max-w-xs flex-col gap-2">
              <Button
                onClick={() => {
                  setError(null)
                  setIsLoading(true)
                  window.location.reload()
                }}
              >
                Refresh Page
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setError(null)
                  setIsLoading(true)
                  dbUtils.initializeDatabase()
                    .then(() => dbUtils.getCurrentUser())
                    .then((loadedUser: any) => {
                      if (loadedUser?.id) {
                        setUserId(loadedUser.id)
                        setError(null)
                      } else {
                        setError('Still unable to load profile. Please try again.')
                      }
                    })
                    .catch(() => setError('Database initialization failed.'))
                    .finally(() => setIsLoading(false))
                }}
              >
                Retry Without Refresh
              </Button>
              <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={resetAllData}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Data & Restart
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error ? (
        <>
          <div className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
            <div className="flex min-w-max gap-2">
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  trackProfileInteraction('sticky_edit_profile')
                  setShowUserDataModal(true)
                }}
              >
                Edit Profile
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  trackProfileInteraction('sticky_update_goal')
                  setShowPlanTemplateFlow(true)
                }}
              >
                Update Goal
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  trackProfileInteraction('sticky_challenges_scroll')
                  document.getElementById('challenges-section')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Challenges
              </Button>
            </div>
          </div>

          <ProfileHeroCard
            runnerName={runnerName}
            runnerLevel={runnerLevel}
            summary={runnerSummary}
            quickFacts={[
              `${allTimeStats.totalRuns} total runs`,
              `${weeklyRuns}/${expectedWeeklyRuns} runs this week`,
              `${allTimeStats.totalDistanceKm.toFixed(1)} km total distance`,
              `${momentumStreakDays} day momentum streak`,
            ]}
            onEditProfile={() => {
              trackProfileInteraction('hero_edit_profile')
              setShowUserDataModal(true)
            }}
            onViewProgress={() => {
              trackProfileInteraction('hero_view_progress')
              document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />

          <div id="goal-section" className="space-y-3">
            <PrimaryGoalCard
              hasGoal={Boolean(primaryGoal)}
              goalTitle={primaryGoal?.title}
              goalDescription={primaryGoal?.description}
              goalTarget={primaryGoalTarget}
              progressValue={primaryGoalProgress}
              trajectory={primaryGoalTrajectory}
              daysRemaining={getDaysRemaining(primaryGoal)}
              deadlineLabel={goalDeadlineLabel}
              coachGuidance={coachGuidance}
              onCreateGoal={() => {
                trackProfileInteraction('goal_create_open')
                setShowPlanTemplateFlow(true)
              }}
              onOpenGoalSettings={() => {
                trackProfileInteraction('goal_settings_open')
                document.getElementById('other-goals')?.scrollIntoView({ behavior: 'smooth' })
              }}
              onViewPlan={() => {
                trackProfileInteraction('goal_view_plan')
                try {
                  window.dispatchEvent(new CustomEvent('navigate-to-plan'))
                } catch {
                  // ignore
                }
              }}
              onDeleteGoal={primaryGoal ? () => {
                trackProfileInteraction('goal_delete_dialog_open')
                openDeleteDialog(primaryGoal)
              } : undefined}
            />

            {secondaryGoals.length > 0 ? (
              <Card id="other-goals" className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Other Goals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {secondaryGoals.map((goal) => (
                    <div key={goal.id} className="rounded-xl border bg-[oklch(var(--surface-2))] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold">{goal.title}</h4>
                          <p className="text-xs text-muted-foreground">{goal.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => goal.id && handleSetPrimary(goal.id)}
                            disabled={isSwitchingPrimary}
                          >
                            <Star className="mr-1 h-3.5 w-3.5" />
                            Primary
                          </Button>
                          {primaryGoal ? (
                            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openMergeDialog(goal)}>
                              <GitMerge className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDeleteDialog(goal)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{Math.round(getGoalProgress(goal.id))}%</span>
                        </div>
                        <Progress value={getGoalProgress(goal.id)} className="h-1.5" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
          <MomentumSnapshotGrid
            weeklyDistanceKm={weeklyDistanceKm}
            weeklyRuns={weeklyRuns}
            totalRuns={allTimeStats.totalRuns}
            totalDistanceKm={allTimeStats.totalDistanceKm}
            consistencyScore={consistencyScore}
            streakDays={momentumStreakDays}
            distanceSparkline={distanceSparkline}
          />

          <div id="challenges-section">
            <ChallengeSection
              isLoading={isChallengesLoading}
              activeChallenge={activeChallenge}
              challengeHistory={challengeHistory}
              availableChallenges={availableChallenges}
              joiningChallengeSlug={joiningChallengeSlug}
              onJoinChallenge={handleJoinChallenge}
            />
          </div>

          <CoachingProfilePanel
            userId={userId}
            coachingStyle={typeof user?.coachingStyle === 'string' ? user.coachingStyle : null}
            onOpenSettings={() => setShowCoachingPreferences(true)}
          />

          <div id="analytics-section">
            <PerformanceAnalyticsSection
              userId={userId}
              totalRuns={allTimeStats.totalRuns}
              weeklyRuns={weeklyRuns}
              consistencyScore={consistencyScore}
            />
          </div>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Training Profile Data</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowUserDataModal(true)} className="h-8 gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              <Accordion
                type="multiple"
                defaultValue={["training-profile", "recent-runs"]}
                onValueChange={(sections) => {
                  trackProfileInteraction('training_sections_toggle', { sections })
                }}
              >
                <AccordionItem value="training-profile">
                  <AccordionTrigger>Profile & Physiological Metrics</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Profile</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Age:</span>
                          <span className="font-medium">{user?.age ?? '--'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Experience:</span>
                          <span className="font-medium capitalize">{user?.experience ?? '--'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Weekly Volume:</span>
                          <span className="font-medium">{typeof user?.averageWeeklyKm === 'number' ? `${user.averageWeeklyKm} km` : '--'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Days/Week:</span>
                          <span className="font-medium">{user?.daysPerWeek ?? '--'}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {(user?.calculatedVDOT || user?.vo2Max || user?.lactateThreshold || user?.hrvBaseline || user?.maxHeartRate || user?.restingHeartRate || user?.lactateThresholdHR) ? (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold">Physiological Metrics</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {user?.calculatedVDOT ? (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">VDOT:</span>
                              <span className="font-medium">{user.calculatedVDOT.toFixed(1)} ({getVDOTRating(user.calculatedVDOT)})</span>
                            </div>
                          ) : null}
                          {user?.vo2Max ? (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">VO2 Max:</span>
                              <span className="font-medium">{user.vo2Max} ml/kg/min</span>
                            </div>
                          ) : null}
                          {user?.lactateThreshold ? (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">LT Pace:</span>
                              <span className="font-medium">{formatPace(user.lactateThreshold)}/km</span>
                            </div>
                          ) : null}
                          {user?.lactateThresholdHR ? (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">LT HR:</span>
                              <span className="font-medium">{user.lactateThresholdHR} bpm</span>
                            </div>
                          ) : null}
                          {user?.hrvBaseline ? (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">HRV Baseline:</span>
                              <span className="font-medium">{user.hrvBaseline} ms</span>
                            </div>
                          ) : null}
                          {user?.maxHeartRate ? (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Max HR:</span>
                              <span className="font-medium">{user.maxHeartRate} bpm</span>
                            </div>
                          ) : null}
                          {user?.restingHeartRate ? (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Resting HR:</span>
                              <span className="font-medium">{user.restingHeartRate} bpm</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <ProfileEmptyState
                        title="No advanced physiology data yet"
                        description="Add VO2 Max, threshold, or race references to improve training personalization and analytics clarity."
                        actionLabel="Update Profile Data"
                        onAction={() => setShowUserDataModal(true)}
                      />
                    )}

                    {user?.referenceRaceDistance && user?.referenceRaceTime ? (
                      <>
                        <Separator />
                        <div>
                          <h4 className="mb-2 text-sm font-semibold">Reference Race</h4>
                          <div className="text-sm">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-muted-foreground">Distance & Time:</span>
                              <span className="font-medium">{user.referenceRaceDistance}K in {formatTime(user.referenceRaceTime)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Pace:</span>
                              <span className="font-medium">{formatPace(user.referenceRaceTime / user.referenceRaceDistance)}/km</span>
                            </div>
                            {user.referenceRaceDate ? (
                              <div className="mt-1 flex items-center justify-between">
                                <span className="text-muted-foreground">Date:</span>
                                <span className="text-xs text-foreground/60">{formatDate(user.referenceRaceDate)}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="recent-runs">
                  <AccordionTrigger>
                    Recent Runs (Last {recentRunsWindowDays} Days)
                  </AccordionTrigger>
                  <AccordionContent>
                    {isRunsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading runs...
                      </div>
                    ) : recentRuns.length === 0 ? (
                      <ProfileEmptyState
                        title="No recent runs"
                        description="Record your next workout to unlock trend insights, pace guidance, and progression analysis."
                      />
                    ) : (
                      <div className="space-y-2">
                        {recentRuns.map((run) => (
                          <div key={run.id} className="rounded-lg border bg-[oklch(var(--surface-2))] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{run.distance.toFixed(2)} km</span>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-sm text-muted-foreground">{formatTime(run.duration)}</span>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-sm text-muted-foreground">{formatPace(run.pace ?? run.duration / run.distance)}/km</span>
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                  {run.importSource === 'garmin' ? 'Garmin • ' : ''}
                                  {new Date(run.completedAt).toLocaleDateString()} • {run.notes ?? run.type}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (!run.id) return
                                  try {
                                    window.dispatchEvent(new CustomEvent('navigate-to-run-report', { detail: { runId: run.id } }))
                                  } catch {
                                    // ignore
                                  }
                                }}
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {runningShoes.length > 0 ? (
                  <AccordionItem value="shoes">
                    <AccordionTrigger>Running Shoes</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {runningShoes.map((shoe) => (
                          <div key={shoe.id} className="flex items-center justify-between rounded-lg border bg-[oklch(var(--surface-2))] p-3">
                            <div className="min-w-0">
                              <p className="font-medium">{shoe.name}</p>
                              <p className="text-sm text-muted-foreground">{shoe.brand} {shoe.model}</p>
                              <p className="text-xs text-muted-foreground">{shoe.currentKm} km / {shoe.maxKm} km</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{Math.round((shoe.currentKm / shoe.maxKm) * 100)}%</p>
                              <div className="mt-1 h-2 w-16 overflow-hidden rounded-full bg-border/60">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${Math.min((shoe.currentKm / shoe.maxKm) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ) : null}
              </Accordion>
            </CardContent>
          </Card>

          <AchievementsSection userId={userId} />

          <IntegrationsListCard
            garminConnected={garminConnected}
            onGarminConnect={() => void handleGarminConnect()}
            onGarminDetails={() => router.push('/garmin/details')}
            rows={integrationRows}
          />

          <SettingsListCard rows={settingsRows} />

          <DeveloperToolsAccordion onResetAllData={resetAllData} />

          <ReminderSettings />

          <div className="space-y-1 pb-4 text-center text-sm text-muted-foreground">
            <p>Run-Smart v1.0.0</p>
            <p>Runner identity and progress hub</p>
          </div>
        </>
      ) : null}

      {showAddShoesModal ? (
        <AddShoesModal
          isOpen={showAddShoesModal}
          onClose={() => {
            setShowAddShoesModal(false)
            const shoes = JSON.parse(localStorage.getItem('running-shoes') || '[]')
            setRunningShoes(shoes)
          }}
        />
      ) : null}

      {userId ? (
        <PlanTemplateFlow
          isOpen={showPlanTemplateFlow}
          onClose={() => setShowPlanTemplateFlow(false)}
          userId={userId}
          onCompleted={loadGoals}
        />
      ) : null}

      {userId ? (
        <JoinCohortModal
          isOpen={showJoinCohortModal}
          onClose={() => setShowJoinCohortModal(false)}
          userId={userId}
        />
      ) : null}

      {showUserDataModal && userId ? (
        <div className="fixed inset-0 z-[60] overflow-auto">
          <UserDataSettings
            userId={userId}
            onBack={() => setShowUserDataModal(false)}
            onSave={refreshContext}
          />
        </div>
      ) : null}

      {showCoachingPreferences && userId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Coaching Preferences</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCoachingPreferences(false)}>
                X
              </Button>
            </div>
            <div className="p-4">
              <CoachingPreferencesSettings
                userId={userId}
                onClose={() => setShowCoachingPreferences(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  This will permanently delete &quot;{goalToDelete?.title}&quot; including:
                </p>
                <ul className="mb-3 list-inside list-disc space-y-1 text-sm">
                  <li>All progress history and milestones</li>
                  <li>Associated training plan workouts</li>
                  <li>Analytics and insights data</li>
                </ul>
                <p className="font-medium text-red-600">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGoalToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGoal}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete Goal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Goal</DialogTitle>
            <DialogDescription asChild>
              <div>
                <p className="mb-3">
                  Merge &quot;{mergeSourceGoal?.title}&quot; into your primary goal &quot;{primaryGoal?.title}&quot;?
                </p>
                <p className="mb-3 text-sm text-foreground/70">
                  This will:
                </p>
                <ul className="mb-3 list-inside list-disc space-y-1 text-sm">
                  <li>Transfer all progress history to your primary goal</li>
                  <li>Move milestones to your primary goal</li>
                  <li>Delete the merged goal</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMergeGoal} className="bg-primary/100 hover:bg-primary/90">
              <GitMerge className="mr-2 h-4 w-4" />
              Merge Goals
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

