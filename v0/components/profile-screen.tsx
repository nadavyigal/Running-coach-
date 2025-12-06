'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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
} from "lucide-react"
import { AddShoesModal } from "@/components/add-shoes-modal"
import { ReminderSettings } from "@/components/reminder-settings"
import { useState, useEffect } from "react"
import { BadgeCabinet } from "@/components/badge-cabinet";
import { dbUtils } from "@/lib/dbUtils";
import { useToast } from "@/components/ui/use-toast";
import { ShareBadgeModal } from "@/components/share-badge-modal";
import { Share2, Users } from "lucide-react";
import { JoinCohortModal } from "@/components/join-cohort-modal";
import { CommunityStatsWidget } from "@/components/community-stats-widget";
import { CoachingInsightsWidget } from "@/components/coaching-insights-widget";
import { CoachingPreferencesSettings } from "@/components/coaching-preferences-settings";
import { GoalProgressDashboard } from "@/components/goal-progress-dashboard";
import { PerformanceAnalyticsDashboard } from "@/components/performance-analytics-dashboard";
import { Brain, Target } from "lucide-react";
import { GoalCreationWizard } from "@/components/goal-creation-wizard";
import { type Goal } from "@/lib/db";
import { regenerateTrainingPlan } from "@/lib/plan-regeneration";

export function ProfileScreen() {
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
  const [showGoalWizard, setShowGoalWizard] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null);

  const handleShareClick = (badgeId: string, badgeName: string) => {
    setSelectedBadge({ id: badgeId, name: badgeName });
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setSelectedBadge(null);
  };

  const goalProgressPercent = (goal?: Goal | null) => {
    if (!goal) return 0;
    const baseline = typeof goal.baselineValue === 'number' ? goal.baselineValue : 0;
    const target = typeof goal.targetValue === 'number' ? goal.targetValue : 0;
    const current = typeof goal.currentValue === 'number' ? goal.currentValue : baseline;
    const denominator = target - baseline;
    if (denominator === 0) return 0;
    return Math.min(100, Math.max(0, ((current - baseline) / denominator) * 100));
  };

  const getDaysRemaining = (goal?: Goal | null) => {
    if (!goal?.timeBound?.deadline) return null;
    const deadline = new Date(goal.timeBound.deadline);
    const diff = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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

  const handleGoalCreated = async (goal?: Goal) => {
    if (!goal?.id || !userId) return;
    try {
      await dbUtils.setPrimaryGoal(userId, goal.id);
      const updatedGoal = await dbUtils.getGoal(goal.id);
      if (updatedGoal) {
        await regenerateTrainingPlan(userId, updatedGoal);
      }
      await loadGoals();
      toast({
        title: 'Goal created',
        description: 'Training plan regenerated to target your new goal.',
      });
    } catch (goalError) {
      console.error('[ProfileScreen] Goal creation flow failed:', goalError);
      toast({
        title: 'Plan update failed',
        description: 'Goal saved, but the training plan could not be regenerated.',
        variant: 'destructive',
      });
    }
  };

  // Add useEffect to load shoes data
  useEffect(() => {
    const shoes = JSON.parse(localStorage.getItem("running-shoes") || "[]")
    setRunningShoes(shoes)
  }, [])

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
          if (users.length > 0 && users[0].id) {
            console.log(`[ProfileScreen] ✅ Fallback found userId: ${users[0].id}`);
            setUserId(users[0].id);
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
    { icon: Shield, name: "Privacy & Data", desc: "Manage your data" },
    { icon: HelpCircle, name: "Help & Support", desc: "Get help and contact us" },
  ]

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Profile</h1>
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
                  indexedDB.deleteDatabase('running-coach-db');
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
          <Button size="sm" className="gap-2" onClick={() => setShowGoalWizard(true)}>
            <Plus className="h-4 w-4" />
            Create Goal
          </Button>
        </div>

        {primaryGoal ? (
          <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-600">PRIMARY GOAL</p>
                  <h3 className="text-lg font-semibold text-gray-900">{primaryGoal.title}</h3>
                  <p className="text-sm text-gray-700">{primaryGoal.description}</p>
                </div>
                <div className="text-right space-y-1">
                  {getDaysRemaining(primaryGoal) !== null && (
                    <Badge variant="secondary" className="text-xs">
                      {getDaysRemaining(primaryGoal)} days left
                    </Badge>
                  )}
                  {primaryGoal.timeBound?.deadline && (
                    <div className="text-xs text-gray-500">
                      Target date: {new Date(primaryGoal.timeBound.deadline).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Progress</span>
                  <span>{Math.round(goalProgressPercent(primaryGoal))}%</span>
                </div>
                <Progress value={goalProgressPercent(primaryGoal)} className="h-2" />
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
              <Button size="sm" onClick={() => setShowGoalWizard(true)} className="gap-2">
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
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                        <p className="text-xs text-gray-600">{goal.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{goal.status}</Badge>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(goalProgressPercent(goal))}%</span>
                      </div>
                      <Progress value={goalProgressPercent(goal)} className="h-1.5" />
                    </div>
                  </div>
                ))}
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
                <span>5 days active</span>
                <span>•</span>
                <span>12 total runs</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Route className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <div className="text-lg font-bold">42.3 km</div>
            <div className="text-xs text-gray-600">Total Distance</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <div className="text-lg font-bold">320 min</div>
            <div className="text-xs text-gray-600">Total Time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
            <div className="text-lg font-bold">5</div>
            <div className="text-xs text-gray-600">Day Streak</div>
          </CardContent>
        </Card>
      </div>

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

      {/* Goal Progress */}
      {userId && (
        <div data-section="goal-progress">
          <GoalProgressDashboard
            userId={userId}
            className="hover:shadow-lg transition-all duration-300"
          />
        </div>
      )}
      
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
                  indexedDB.deleteDatabase('RunSmartDB');
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
        <GoalCreationWizard
          isOpen={showGoalWizard}
          onClose={() => setShowGoalWizard(false)}
          userId={userId}
          onGoalCreated={handleGoalCreated}
        />
      )}

      {userId && (
        <JoinCohortModal
          isOpen={showJoinCohortModal}
          onClose={() => setShowJoinCohortModal(false)}
          userId={userId}
        />
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
      </>
      )}
    </div>
  )
}
