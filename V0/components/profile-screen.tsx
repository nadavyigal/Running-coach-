'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
} from "lucide-react"
import { AddShoesModal } from "@/components/add-shoes-modal"
import { ReminderSettings } from "@/components/reminder-settings"
import { useState, useEffect } from "react"
import { BadgeCabinet } from "@/components/badge-cabinet";
import { dbUtils } from "@/lib/db";
import { useToast } from "@/components/ui/use-toast";
import { ShareBadgeModal } from "@/components/share-badge-modal";
import { Share2, Users } from "lucide-react";
import { JoinCohortModal } from "@/components/join-cohort-modal";
import { CommunityStatsWidget } from "@/components/community-stats-widget";
import { CoachingInsightsWidget } from "@/components/coaching-insights-widget";
import { CoachingPreferencesSettings } from "@/components/coaching-preferences-settings";
import { Brain } from "lucide-react";

export function ProfileScreen() {
  // Add state for the shoes modal at the top of the component
  const [showAddShoesModal, setShowAddShoesModal] = useState(false)
  const [runningShoes, setRunningShoes] = useState<any[]>([])
  const [userId, setUserId] = useState<number | null>(null);
  const { toast } = useToast();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<{ id: string; name: string } | null>(null);
  const [showJoinCohortModal, setShowJoinCohortModal] = useState(false);
  const [showCoachingPreferences, setShowCoachingPreferences] = useState(false);

  const handleShareClick = (badgeId: string, badgeName: string) => {
    setSelectedBadge({ id: badgeId, name: badgeName });
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setSelectedBadge(null);
  };

  // Add useEffect to load shoes data
  useEffect(() => {
    const shoes = JSON.parse(localStorage.getItem("running-shoes") || "[]")
    setRunningShoes(shoes)
  }, [])

  useEffect(() => {
    dbUtils.getCurrentUser().then(async user => {
      if (user) {
        setUserId(user.id!);
        // Check for new badge unlocks after streak update
        const unlocked = await dbUtils.checkAndUnlockBadges(user.id!);
        if (unlocked && unlocked.length > 0) {
          unlocked.forEach(badge => {
            toast({
              title: `🏅 Badge Unlocked!`,
              description: `You earned the ${badge.type} badge for a ${badge.milestone}-day streak!`,
            });
          });
        }
      }
    });
  }, []);

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
    </div>
  )
}
