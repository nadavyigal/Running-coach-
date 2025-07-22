"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play, 
  Pause,
  AlertTriangle,
  Activity,
  Heart,
  BarChart3,
  Download
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SyncJob {
  id: number
  userId: number
  deviceId: number
  type: 'activities' | 'heart_rate' | 'metrics' | 'full_sync'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'normal' | 'high'
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  retryCount: number
  maxRetries: number
  progress?: number
  metadata?: any
  createdAt: string
  updatedAt: string
}

interface SyncStats {
  total: number
  pending?: number
  running?: number
  completed?: number
  failed?: number
  cancelled?: number
}

interface BackgroundSyncStatusProps {
  userId: number
  deviceId?: number
  autoRefresh?: boolean
  compact?: boolean
}

export function BackgroundSyncStatus({ 
  userId, 
  deviceId, 
  autoRefresh = true,
  compact = false 
}: BackgroundSyncStatusProps) {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [stats, setStats] = useState<SyncStats>({ total: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isScheduling, setIsScheduling] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSyncJobs()
    
    if (autoRefresh) {
      const interval = setInterval(loadSyncJobs, 10000) // Refresh every 10 seconds
      return () => clearInterval(interval)
    }
  }, [userId, deviceId, autoRefresh])

  const loadSyncJobs = async () => {
    try {
      const params = new URLSearchParams({ 
        userId: userId.toString(),
        limit: '20'
      })

      const response = await fetch(`/api/sync/jobs?${params}`)
      const data = await response.json()

      if (data.success) {
        setJobs(data.jobs || [])
        setStats(data.stats || { total: 0 })
      }
    } catch (error) {
      console.error('Error loading sync jobs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const scheduleSync = async (type: SyncJob['type'], priority: SyncJob['priority'] = 'normal') => {
    if (!deviceId) {
      toast({
        title: "No Device Selected",
        description: "Please select a device to sync with",
        variant: "destructive"
      })
      return
    }

    setIsScheduling(true)
    try {
      const response = await fetch('/api/sync/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          deviceId,
          type,
          priority
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Sync Scheduled",
          description: `${getSyncTypeLabel(type)} sync has been scheduled`
        })
        loadSyncJobs()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error scheduling sync:', error)
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to schedule sync",
        variant: "destructive"
      })
    } finally {
      setIsScheduling(false)
    }
  }

  const cancelJob = async (jobId: number) => {
    try {
      const response = await fetch(`/api/sync/jobs?jobId=${jobId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Job Cancelled",
          description: "Sync job has been cancelled"
        })
        loadSyncJobs()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error cancelling job:', error)
      toast({
        title: "Cancel Failed",
        description: "Failed to cancel sync job",
        variant: "destructive"
      })
    }
  }

  const cancelAllPending = async () => {
    try {
      const response = await fetch(`/api/sync/jobs?userId=${userId}&cancelAll=true`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Jobs Cancelled",
          description: data.message
        })
        loadSyncJobs()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error cancelling all jobs:', error)
      toast({
        title: "Cancel Failed",
        description: "Failed to cancel pending jobs",
        variant: "destructive"
      })
    }
  }

  const getSyncTypeIcon = (type: string) => {
    switch (type) {
      case 'activities': return Activity
      case 'heart_rate': return Heart
      case 'metrics': return BarChart3
      case 'full_sync': return Download
      default: return RefreshCw
    }
  }

  const getSyncTypeLabel = (type: string) => {
    switch (type) {
      case 'activities': return 'Activities'
      case 'heart_rate': return 'Heart Rate'
      case 'metrics': return 'Metrics'
      case 'full_sync': return 'Full Sync'
      default: return type
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'failed': return XCircle
      case 'running': return RefreshCw
      case 'pending': return Clock
      case 'cancelled': return Pause
      default: return Clock
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'running': return 'text-blue-600'
      case 'pending': return 'text-yellow-600'
      case 'cancelled': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600'
      case 'normal': return 'text-blue-600'
      case 'low': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (compact) {
    const runningJobs = jobs.filter(job => job.status === 'running')
    const pendingJobs = jobs.filter(job => job.status === 'pending')
    
    if (runningJobs.length === 0 && pendingJobs.length === 0) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>Sync up to date</span>
        </div>
      )
    }

    return (
      <div className="flex items-center space-x-2">
        {runningJobs.length > 0 && (
          <div className="flex items-center space-x-1">
            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
            <span className="text-sm text-blue-600">Syncing...</span>
          </div>
        )}
        {pendingJobs.length > 0 && (
          <Badge variant="outline">
            {pendingJobs.length} pending
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5" />
            <span>Background Sync</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={loadSyncJobs} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.total || 0}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.running || 0}</div>
            <div className="text-sm text-gray-600">Running</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed || 0}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failed || 0}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="space-y-3">
          <h4 className="font-medium">Quick Sync</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => scheduleSync('activities')}
              disabled={isScheduling || !deviceId}
            >
              <Activity className="h-4 w-4 mr-1" />
              Activities
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => scheduleSync('heart_rate')}
              disabled={isScheduling || !deviceId}
            >
              <Heart className="h-4 w-4 mr-1" />
              Heart Rate
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => scheduleSync('metrics')}
              disabled={isScheduling || !deviceId}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Metrics
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => scheduleSync('full_sync', 'high')}
              disabled={isScheduling || !deviceId}
            >
              <Download className="h-4 w-4 mr-1" />
              Full Sync
            </Button>
          </div>
          {!deviceId && (
            <p className="text-sm text-gray-500">Connect a device to enable sync</p>
          )}
        </div>

        <Separator />

        {/* Recent Jobs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Recent Jobs</h4>
            {stats.pending && stats.pending > 0 && (
              <Button variant="ghost" size="sm" onClick={cancelAllPending}>
                Cancel All Pending
              </Button>
            )}
          </div>
          
          {jobs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No sync jobs found
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.slice(0, 10).map((job) => {
                const TypeIcon = getSyncTypeIcon(job.type)
                const StatusIcon = getStatusIcon(job.status)
                
                return (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <TypeIcon className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">{getSyncTypeLabel(job.type)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <StatusIcon className={`h-4 w-4 ${getStatusColor(job.status)} ${job.status === 'running' ? 'animate-spin' : ''}`} />
                        <Badge className={getStatusBadgeColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>

                      <Badge variant="outline" className={getPriorityColor(job.priority)}>
                        {job.priority}
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-2">
                      {job.status === 'running' && job.progress !== undefined && (
                        <div className="w-20">
                          <Progress value={job.progress} className="h-2" />
                        </div>
                      )}
                      
                      <span className="text-sm text-gray-500">
                        {formatRelativeTime(job.createdAt)}
                      </span>

                      {job.status === 'pending' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => cancelJob(job.id)}
                        >
                          Cancel
                        </Button>
                      )}

                      {job.status === 'failed' && job.errorMessage && (
                        <div className="flex items-center space-x-1">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-xs text-red-600 max-w-20 truncate" title={job.errorMessage}>
                            {job.errorMessage}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}