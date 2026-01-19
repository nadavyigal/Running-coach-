'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ExternalLink, TrendingUp, Users, Activity, Calendar } from 'lucide-react'
import { UserListTable } from './user-list-table'

type Metrics = {
  totalUsers: number
  activeUsers: number // Active in last 7 days
  totalRuns: number
  runsThisWeek: number
  avgRunsPerUser: number
  onboardingCompletion: number // Percentage
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalUsers: 0,
    activeUsers: 0,
    totalRuns: 0,
    runsThisWeek: 0,
    avgRunsPerUser: 0,
    onboardingCompletion: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  async function fetchMetrics() {
    const supabase = createClient()

    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Active users (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { data: activeUserData } = await supabase
        .from('runs')
        .select('profile_id')
        .gte('completed_at', sevenDaysAgo.toISOString())

      const activeUsers = new Set(activeUserData?.map(r => r.profile_id)).size

      // Total runs
      const { count: totalRuns } = await supabase
        .from('runs')
        .select('*', { count: 'exact', head: true })

      // Runs this week
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const { count: runsThisWeek } = await supabase
        .from('runs')
        .select('*', { count: 'exact', head: true })
        .gte('completed_at', weekStart.toISOString())

      // Average runs per user
      const avgRunsPerUser = totalUsers ? (totalRuns || 0) / totalUsers : 0

      // Onboarding completion rate
      const { count: completedOnboarding } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('onboarding_complete', true)

      const onboardingCompletion = totalUsers
        ? ((completedOnboarding || 0) / totalUsers) * 100
        : 0

      setMetrics({
        totalUsers: totalUsers || 0,
        activeUsers,
        totalRuns: totalRuns || 0,
        runsThisWeek: runsThisWeek || 0,
        avgRunsPerUser: Math.round(avgRunsPerUser * 10) / 10,
        onboardingCompletion: Math.round(onboardingCompletion),
      })
    } catch (error) {
      console.error('[AdminDashboard] Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">RunSmart AI Analytics & Metrics</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            icon={Users}
            title="Total Users"
            value={metrics.totalUsers}
            loading={loading}
          />
          <MetricCard
            icon={Activity}
            title="Active Users (7d)"
            value={metrics.activeUsers}
            loading={loading}
          />
          <MetricCard
            icon={TrendingUp}
            title="Total Runs"
            value={metrics.totalRuns}
            loading={loading}
          />
          <MetricCard
            icon={Calendar}
            title="Runs This Week"
            value={metrics.runsThisWeek}
            loading={loading}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Average Runs Per User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {loading ? '...' : metrics.avgRunsPerUser}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Onboarding Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {loading ? '...' : `${metrics.onboardingCompletion}%`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Links */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>External Analytics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExternalLinkCard
              href="https://us.i.posthog.com"
              title="PostHog Analytics"
              description="Behavioral analytics, feature flags, and session recordings"
              icon="📊"
            />
            <ExternalLinkCard
              href="https://analytics.google.com/analytics/web/#/p463916086/reports/intelligenthome"
              title="Google Analytics"
              description="Traffic sources, demographics, and conversion metrics"
              icon="📈"
            />
          </CardContent>
        </Card>

        {/* User List */}
        <UserListTable />
      </div>
    </div>
  )
}

type MetricCardProps = {
  icon: React.ElementType
  title: string
  value: number
  loading: boolean
}

function MetricCard({ icon: Icon, title, value, loading }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {loading ? '...' : value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}

type ExternalLinkCardProps = {
  href: string
  title: string
  description: string
  icon: string
}

function ExternalLinkCard({ href, title, description, icon }: ExternalLinkCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{title}</h3>
            <ExternalLink className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </a>
  )
}
