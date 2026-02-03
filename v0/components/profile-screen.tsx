'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
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
import {
  Settings,
  User,
  Route,
  Clock,
  Flame,
  Footprints,
  Watch,
  Music,
  Heart,
  Plus,
  UserCheckIcon as UserEdit,
  Bell,
  Shield,
  HelpCircle,
  ChevronRight,
  Loader2,
  AlertCircle,
  Trash2,
  Database,
  Activity,
  History,
  Pencil,
  Trophy,
} from "lucide-react"
import { AddShoesModal } from "@/components/add-shoes-modal"
import { ReminderSettings } from "@/components/reminder-settings"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BadgeCabinet } from "@/components/badge-cabinet";
import { dbUtils } from "@/lib/dbUtils";
import { DATABASE } from "@/lib/constants";
import { useData } from "@/contexts/DataContext";
import { useToast } from "@/components/ui/use-toast";
import { getChallengeHistory } from "@/lib/challengeEngine";
import type { ChallengeProgress, ChallengeTemplate } from "@/lib/db";
import { ShareBadgeModal } from "@/components/share-badge-modal";
import { Share2, Users } from "lucide-react";
import { JoinCohortModal } from "@/components/join-cohort-modal";
import { CommunityStatsWidget } from "@/components/community-stats-widget";
import { CoachingInsightsWidget } from "@/components/coaching-insights-widget";
import { CoachingPreferencesSettings } from "@/components/coaching-preferences-settings";
import { PerformanceAnalyticsDashboard } from "@/components/performance-analytics-dashboard";
import { Brain, Target, GitMerge, Star } from "lucide-react";
import { PlanTemplateFlow } from "@/components/plan-template-flow";
import { type Goal, type Run } from "@/lib/db";
import { GoalProgressEngine, type GoalProgress } from "@/lib/goalProgressEngine";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { UserDataSettings } from "@/components/user-data-settings";
import { RunSmartBrandMark } from "@/components/run-smart-brand-mark";

export function ProfileScreen() {
  const router = useRouter()

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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<{ id: string; name: string } | null>(null);
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
  const [mergeSourceGoal, setMergeSourceGoal] = useState<Goal | null>(null)
  const [isSwitchingPrimary, setIsSwitchingPrimary] = useState(false)

  // Sync from context
  useEffect(() => {
    if (contextUserId) setUserId(contextUserId)
    if (contextPrimaryGoal) setPrimaryGoal(contextPrimaryGoal)
    if (activeGoals.length > 0) setGoals(activeGoals)
    if (contextRecentRuns.length > 0) setRecentRuns(contextRecentRuns)
  }, [contextUserId, contextPrimaryGoal, activeGoals, contextRecentRuns])

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

  // Load challenge history
  useEffect(() => {
    const loadChallengeHistory = async () => {
      if (!userId) {
        setChallengeHistory([])
        return
      }

      setIsChallengesLoading(true)
      try {
        const history = await getChallengeHistory(userId)
        setChallengeHistory(history)
      } catch (error) {
        console.error("Error loading challenge history:", error)
        setChallengeHistory([])
      } finally {
        setIsChallengesLoading(false)
      }
    }

    loadChallengeHistory()
  }, [userId])

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

  const handleShareClick = (badgeId: string, badgeName: string) => {
    setSelectedBadge({ id: badgeId, name: badgeName });
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setSelectedBadge(null);
  };

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

  const loadGoals = async () => {
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
  };

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
        const runs = await dbUtils.getUserRuns(userId, 10)
        if (!cancelled) setRecentRuns(runs)
      } catch (err) {
        console.warn('[ProfileScreen] Failed to load runs:', err)
      } finally {
        if (!cancelled) setIsRunsLoading(false)
      }
    }

    loadRuns()

    const onRunSaved = () => loadRuns()
    window.addEventListener('run-saved', onRunSaved)
    return () => {
      cancelled = true
      window.removeEventListener('run-saved', onRunSaved)
    }
  }, [userId])

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
          console.log(`[ProfileScreen] ✅ User loaded: id=${user.id}`);
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
                  title: `🏅 Badge Unlocked!`,
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
          console.error('[ProfileScreen] ❌ All retry attempts exhausted');
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
            console.log(`[ProfileScreen] ✅ Fallback found userId: ${firstUser.id}`);
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
      loadGoals();
    }
  }, [userId]);

  const connections = [
    { icon: Footprints, name: "Add Shoes", desc: "Track your running shoes mileage" },
    { icon: Users, name: "Join a Cohort", desc: "Join a community group with an invite code" },
    { icon: Watch, name: "Connect to Watch", desc: "Sync with Apple Watch, Garmin, etc." },
    { icon: Music, name: "Connect to Spotify", desc: "Sync your running playlists" },
    { icon: Heart, name: "Connect to Fitness Apps", desc: "Sync with Strava, Nike Run Club, etc." },
    { icon: Plus, name: "Connect to Health", desc: "Sync with Apple Health or Google Fit" },
  ]

  const settings = [
    { icon: UserEdit, name: "Edit Profile", desc: "Name, goals, and preferences" },
    { icon: Target, name: "Goal Settings", desc: "Manage your running goals and targets", action: "goal-settings" },
    { icon: Brain, name: "Coaching Preferences", desc: "Customize your AI coach behavior", action: "coaching-preferences" },
    { icon: Bell, name: "Notifications", desc: "Reminders and updates" },
    { icon: Shield, name: "Privacy & Data", desc: "Manage your data", action: "privacy" },
    { icon: HelpCircle, name: "Help & Support", desc: "Get help and contact us" },
  ]

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RunSmartBrandMark compact size="lg" className="opacity-90" />
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>
        <Button variant="ghost" size="sm">
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-700 mb-4" />
            <p className="text-gray-600">Loading profile data...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-red-200">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load Profile</h3>
            <p className="text-gray-600 mb-4">{error}</p>

            {/* Database Status Indicator */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 bg-gray-50 px-3 py-2 rounded-lg">
              <Database className="h-3 w-3" />
              <span>Database: {typeof indexedDB !== 'undefined' ? 'Available' : 'Not Available'}</span>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  // Trigger re-mount by updating a key or reloading
                  window.location.reload();
                }}
                variant="default"
              >
                Refresh Page
              </Button>
              <Button
                onClick={() => {
                  // Try to re-initialize the database
                  setError(null);
                  setIsLoading(true);
                  dbUtils.initializeDatabase().then(() => {
                    dbUtils.getCurrentUser().then((user: any) => {
                      if (user) {
                        setUserId(user.id!);
                        setError(null);
                      } else {
                        setError("Still unable to load profile. Please try again.");
                      }
                      setIsLoading(false);
                    }).catch(() => {
                      setError("Failed to load user data.");
                      setIsLoading(false);
                    });
                  }).catch(() => {
                    setError("Database initialization failed.");
                    setIsLoading(false);
                  });
                }}
                variant="outline"
              >
                Retry Without Refresh
              </Button>
              <Button
                onClick={() => {
                  // Clear all data and restart
                  localStorage.clear();
                  [DATABASE.NAME, 'running-coach-db', 'RunningCoachDB'].forEach((dbName) => {
                    try {
                      indexedDB.deleteDatabase(dbName);
                    } catch {
                      // Best-effort cleanup
                    }
                  });
                  toast({
                    title: "Data Cleared",
                    description: "Restarting with fresh data...",
                  });
                  setTimeout(() => window.location.reload(), 500);
                }}
                variant="ghost"
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Data & Restart
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              If this persists, try clearing your browser cache or using incognito mode.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Show content only when not loading and no error */}
      {!isLoading && !error && (
        <>

          {/* Goals */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Goals</h2>
              <Button size="sm" className="gap-2" onClick={() => setShowPlanTemplateFlow(true)}>
                <Plus className="h-4 w-4" />
                Create Goal
              </Button>
            </div>

            {primaryGoal ? (
              <Card className="border">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-600">PRIMARY GOAL</p>
                      <h3 className="text-lg font-semibold text-gray-900">{primaryGoal.title}</h3>
                      <p className="text-sm text-gray-700">{primaryGoal.description}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-right space-y-1">
                        {getDaysRemaining(primaryGoal) !== null && (
                          <Badge variant="secondary" className="text-xs">
                            {getDaysRemaining(primaryGoal)} days left
                          </Badge>
                        )}
                        {primaryGoal.timeBound?.deadline && (
                          <div className="text-xs text-gray-500">
                            Target date:{' '}
                            {(() => {
                              const deadline = new Date(primaryGoal.timeBound.deadline);
                              return Number.isNaN(deadline.getTime()) ? '--' : deadline.toLocaleDateString();
                            })()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => openDeleteDialog(primaryGoal)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete goal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Progress</span>
                      <div className="flex items-center gap-2">
                        <span>{Math.round(getGoalProgress(primaryGoal.id))}%</span>
                        {getGoalTrajectory(primaryGoal.id) && (
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${getGoalTrajectory(primaryGoal.id) === 'ahead' ? 'text-emerald-600 border-emerald-300' :
                                getGoalTrajectory(primaryGoal.id) === 'on_track' ? 'text-blue-600 border-blue-300' :
                                  getGoalTrajectory(primaryGoal.id) === 'behind' ? 'text-amber-600 border-amber-300' :
                                    'text-red-600 border-red-300'
                              }`}
                          >
                            {getGoalTrajectory(primaryGoal.id)?.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={getGoalProgress(primaryGoal.id)} className="h-2" />
                    <p className="text-xs text-gray-600">
                      This plan is designed to help you achieve your goal by the target date.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">No active goal</h3>
                    <p className="text-sm text-gray-600">Set a goal to get a tailored training plan.</p>
                  </div>
                  <Button size="sm" onClick={() => setShowPlanTemplateFlow(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Goal
                  </Button>
                </CardContent>
              </Card>
            )}

            {goals.filter(g => !primaryGoal || g.id !== primaryGoal.id).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Other Goals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {goals
                    .filter(g => !primaryGoal || g.id !== primaryGoal.id)
                    .map(goal => (
                      <div key={goal.id} className="p-3 rounded-lg border bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                            <p className="text-xs text-gray-600">{goal.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              onClick={() => goal.id && handleSetPrimary(goal.id)}
                              disabled={isSwitchingPrimary}
                              title="Set as primary goal"
                            >
                              <Star className="h-3.5 w-3.5 mr-1" />
                              Primary
                            </Button>
                            {primaryGoal && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs"
                                onClick={() => openMergeDialog(goal)}
                                title="Merge into primary goal"
                              >
                                <GitMerge className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <button
                              onClick={() => openDeleteDialog(goal)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete goal"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Progress</span>
                            <div className="flex items-center gap-2">
                              <span>{Math.round(getGoalProgress(goal.id))}%</span>
                              {getGoalTrajectory(goal.id) && (
                                <span className={`capitalize ${getGoalTrajectory(goal.id) === 'ahead' ? 'text-emerald-600' :
                                    getGoalTrajectory(goal.id) === 'on_track' ? 'text-blue-600' :
                                      getGoalTrajectory(goal.id) === 'behind' ? 'text-amber-600' :
                                        'text-red-600'
                                  }`}>
                                  {getGoalTrajectory(goal.id)?.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <Progress value={getGoalProgress(goal.id)} className="h-1.5" />
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Challenge History */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Challenges</h2>
            </div>

            {isChallengesLoading ? (
              <Card>
                <CardContent className="p-8 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-700 mb-4" />
                  <p className="text-gray-600">Loading challenges...</p>
                </CardContent>
              </Card>
            ) : challengeHistory.length > 0 ? (
              <div className="space-y-3">
                {challengeHistory.map((challenge) => (
                  <Card key={challenge.progress.id} className="border">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            <p className="text-xs font-semibold text-emerald-600">COMPLETED</p>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">{challenge.template.name}</h3>
                          <p className="text-sm text-gray-700">{challenge.template.tagline}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {challenge.template.durationDays} days
                        </Badge>
                      </div>

                      <div className="flex gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span>{challenge.progress.streakDays}-day streak</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          <span>{challenge.progress.totalDaysCompleted} runs completed</span>
                        </div>
                      </div>

                      {challenge.progress.completedAt && (
                        <p className="text-xs text-gray-500">
                          Completed {new Date(challenge.progress.completedAt).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">No challenges yet</h3>
                    <p className="text-sm text-gray-600">Start a challenge to build consistency and reach your goals.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* User Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">Runner</h2>
                  <p className="text-gray-600">Beginner Runner</p>
                  <div className="flex gap-2 text-sm text-gray-500 mt-1">
                    <span>{allTimeStats.totalRuns} total runs</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Training Data */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                <CardTitle>Training Data</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUserDataModal(true)}
                className="h-8 gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <User className="h-4 w-4" />
                  Profile
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Age:</span>
                    <span className="font-medium">{user?.age ?? '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Experience:</span>
                    <span className="font-medium capitalize">{user?.experience ?? '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weekly Volume:</span>
                    <span className="font-medium">
                      {typeof user?.averageWeeklyKm === 'number' ? `${user.averageWeeklyKm} km` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Days/Week:</span>
                    <span className="font-medium">{user?.daysPerWeek ?? '--'}</span>
                  </div>
                </div>
              </div>

              {(user?.calculatedVDOT || user?.vo2Max || user?.lactateThreshold || user?.hrvBaseline || user?.maxHeartRate || user?.restingHeartRate || user?.lactateThresholdHR) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4" />
                      Physiological Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {user?.calculatedVDOT && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">VDOT:</span>
                          <span className="font-medium flex items-center gap-1">
                            {user.calculatedVDOT.toFixed(1)}
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              {getVDOTRating(user.calculatedVDOT)}
                            </Badge>
                          </span>
                        </div>
                      )}
                      {user?.vo2Max && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">VO2 Max:</span>
                          <span className="font-medium">{user.vo2Max} ml/kg/min</span>
                        </div>
                      )}
                      {user?.lactateThreshold && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">LT Pace:</span>
                          <span className="font-medium">{formatPace(user.lactateThreshold)}/km</span>
                        </div>
                      )}
                      {user?.lactateThresholdHR && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">LT HR:</span>
                          <span className="font-medium">{user.lactateThresholdHR} bpm</span>
                        </div>
                      )}
                      {user?.hrvBaseline && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">HRV Baseline:</span>
                          <span className="font-medium">{user.hrvBaseline} ms</span>
                        </div>
                      )}
                      {user?.maxHeartRate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max HR:</span>
                          <span className="font-medium">
                            {user.maxHeartRate} bpm
                            {user.maxHeartRateSource === 'calculated' && (
                              <span className="text-xs text-gray-500 ml-1">(calc)</span>
                            )}
                          </span>
                        </div>
                      )}
                      {user?.restingHeartRate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Resting HR:</span>
                          <span className="font-medium">{user.restingHeartRate} bpm</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {user?.referenceRaceDistance && user?.referenceRaceTime && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4" />
                      Reference Race
                    </h4>
                    <div className="text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-600">Distance & Time:</span>
                        <span className="font-medium">
                          {user.referenceRaceDistance}K in {formatTime(user.referenceRaceTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Pace:</span>
                        <span className="font-medium">
                          {formatPace(user.referenceRaceTime / user.referenceRaceDistance)}/km
                        </span>
                      </div>
                      {user.referenceRaceDate && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-600">Date:</span>
                          <span className="text-gray-500 text-xs">
                            {formatDate(user.referenceRaceDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {user?.historicalRuns && user.historicalRuns.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <History className="h-4 w-4" />
                      Training History
                    </h4>
                    <div className="text-sm text-gray-600">
                      {user.historicalRuns.length} significant run{user.historicalRuns.length !== 1 ? 's' : ''} logged
                    </div>
                  </div>
                </>
              )}

              {!user?.vo2Max && !user?.lactateThreshold && !user?.referenceRaceDistance && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                  <p className="text-blue-900 font-medium mb-1">
                    Add your training data
                  </p>
                  <p className="text-blue-700 text-xs">
                    Metrics like VO2 max, lactate threshold, and race times help us personalize your training plan.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Route className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <div className="text-lg font-bold">{allTimeStats.totalDistanceKm.toFixed(1)} km</div>
                <div className="text-xs text-gray-600">Total Distance</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <div className="text-lg font-bold">{Math.round(allTimeStats.totalDurationSeconds / 60)} min</div>
                <div className="text-xs text-gray-600">Total Time</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                <div className="text-lg font-bold">{allTimeStats.totalRuns}</div>
                <div className="text-xs text-gray-600">Total Runs</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Runs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isRunsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading runs...
                </div>
              ) : recentRuns.length === 0 ? (
                <p className="text-sm text-gray-600">No runs yet.</p>
              ) : (
                recentRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-white">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{run.distance.toFixed(2)} km</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-sm text-gray-700">{formatTime(run.duration)}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-sm text-gray-700">{formatPace(run.pace ?? run.duration / run.distance)}/km</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {new Date(run.completedAt).toLocaleDateString()} • {run.type}
                        {run.runReport ? ' • report ready' : ''}
                      </div>
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
                ))
              )}
            </CardContent>
          </Card>

          {/* Adaptive Coaching Widget */}
          {userId && (
            <CoachingInsightsWidget
              userId={userId}
              showDetails={false}
              onSettingsClick={() => setShowCoachingPreferences(true)}
              className="hover:shadow-lg transition-all duration-300"
            />
          )}

          {/* Achievements */}
          {userId && <BadgeCabinet userId={userId} />}

          {/* Performance Analytics */}
          {userId ? (
            <PerformanceAnalyticsDashboard
              userId={userId}
            />
          ) : isLoading ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Loading analytics...
              </CardContent>
            </Card>
          ) : null}

          {/* Community Stats Widget */}
          {userId && <CommunityStatsWidget userId={userId} />}

          {userId && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-2xl font-bold">Share All Badges</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleShareClick("all-badges", "All Badges")}>
                  <Share2 className="mr-2 h-4 w-4" /> Share All
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">Share your entire badge collection with friends and on social media.</p>
              </CardContent>
            </Card>
          )}

          {selectedBadge && (
            <ShareBadgeModal
              badgeId={selectedBadge.id}
              badgeName={selectedBadge.name}
              isOpen={isShareModalOpen}
              onClose={handleCloseShareModal}
            />
          )}

          {runningShoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your Running Shoes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {runningShoes.map((shoe) => (
                  <div key={shoe.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Footprints className="h-5 w-5 text-gray-600" />
                      <div>
                        <div className="font-medium">{shoe.name}</div>
                        <div className="text-sm text-gray-600">
                          {shoe.brand} {shoe.model}
                        </div>
                        <div className="text-xs text-gray-500">
                          {shoe.currentKm}km / {shoe.maxKm}km
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{Math.round((shoe.currentKm / shoe.maxKm) * 100)}%</div>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${Math.min((shoe.currentKm / shoe.maxKm) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Devices & Apps */}
          <Card>
            <CardHeader>
              <CardTitle>Devices & Apps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {connections.map((connection, index) => {
                const handleClick = () => {
                  if (connection.name === "Add Shoes") {
                    setShowAddShoesModal(true);
                  } else if (connection.name === "Join a Cohort") {
                    setShowJoinCohortModal(true);
                  }
                  // Add other connection handlers here
                };

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={handleClick}
                  >
                    <div className="flex items-center gap-3">
                      <connection.icon className="h-5 w-5 text-gray-600" />
                      <div>
                        <div className="font-medium">{connection.name}</div>
                        <div className="text-sm text-gray-600">{connection.desc}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.map((setting, index) => {
                const handleSettingClick = () => {
                  if (setting.action === "coaching-preferences") {
                    setShowCoachingPreferences(true);
                  } else if (setting.action === "goal-settings") {
                    // Navigate to goal settings - could scroll to goal dashboard
                    const goalSection = document.querySelector('[data-section="goal-progress"]');
                    if (goalSection) {
                      goalSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  } else if (setting.action === "privacy") {
                    router.push('/privacy')
                  }
                  // Add other setting handlers here
                };

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={handleSettingClick}
                  >
                    <div className="flex items-center gap-3">
                      <setting.icon className="h-5 w-5 text-gray-600" />
                      <div>
                        <div className="font-medium">{setting.name}</div>
                        <div className="text-sm text-gray-600">{setting.desc}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Developer/Testing Tools */}
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="text-red-900 flex items-center gap-2">
                <Database className="h-5 w-5" />
                Developer Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-white rounded-lg border border-red-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-red-900">Reset App Data</div>
                    <div className="text-sm text-red-700 mt-1">
                      Clear all local data including user profile, workouts, and cached data.
                      This will reset the app to its initial state.
                    </div>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    if (confirm('Are you sure you want to reset all app data? This cannot be undone.')) {
                      // Clear IndexedDB
                      [DATABASE.NAME, 'running-coach-db', 'RunningCoachDB'].forEach((dbName) => {
                        try {
                          indexedDB.deleteDatabase(dbName);
                        } catch {
                          // Best-effort cleanup
                        }
                      });
                      // Clear localStorage
                      localStorage.clear();
                      // Clear sessionStorage
                      sessionStorage.clear();
                      // Reload page
                      window.location.reload();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset All Data
                </Button>
              </div>
            </CardContent>
          </Card>

          <ReminderSettings />

          {/* App Info */}
          <div className="text-center text-sm text-gray-500 space-y-1">
            <p>Run-Smart v1.0.0</p>
            <p>Made with ❤️ for runners</p>
          </div>
          {showAddShoesModal && (
            <AddShoesModal
              isOpen={showAddShoesModal}
              onClose={() => {
                setShowAddShoesModal(false)
                // Reload shoes data
                const shoes = JSON.parse(localStorage.getItem("running-shoes") || "[]")
                setRunningShoes(shoes)
              }}
            />
          )}

          {userId && (
            <PlanTemplateFlow
              isOpen={showPlanTemplateFlow}
              onClose={() => setShowPlanTemplateFlow(false)}
              userId={userId}
              onCompleted={loadGoals}
            />
          )}

          {userId && (
            <JoinCohortModal
              isOpen={showJoinCohortModal}
              onClose={() => setShowJoinCohortModal(false)}
              userId={userId}
            />
          )}

          {showUserDataModal && userId && (
            <div className="fixed inset-0 z-[60] overflow-auto">
              <UserDataSettings
                userId={userId}
                onBack={() => setShowUserDataModal(false)}
                onSave={refreshContext}
              />
            </div>
          )}

          {/* Coaching Preferences Modal */}
          {showCoachingPreferences && userId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Coaching Preferences</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCoachingPreferences(false)}
                  >
                    ×
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
          )}

          {/* Delete Goal Confirmation Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    <p className="mb-3">
                      This will permanently delete &quot;{goalToDelete?.title}&quot; including:
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1 mb-3">
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

          {/* Merge Goal Dialog */}
          <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Merge Goal</DialogTitle>
                <DialogDescription asChild>
                  <div>
                    <p className="mb-3">
                      Merge &quot;{mergeSourceGoal?.title}&quot; into your primary goal &quot;{primaryGoal?.title}&quot;?
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      This will:
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1 mb-3">
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
                <Button onClick={handleMergeGoal} className="bg-blue-500 hover:bg-blue-600">
                  <GitMerge className="h-4 w-4 mr-2" />
                  Merge Goals
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </>
      )}
    </div>
  )
}
