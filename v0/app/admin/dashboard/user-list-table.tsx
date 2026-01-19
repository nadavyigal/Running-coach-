'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle } from 'lucide-react'

type UserRow = {
  id: string
  email: string
  name: string | null
  onboarding_complete: boolean
  created_at: string
  runs_count: number
  goals_count: number
  last_activity: string | null
}

export function UserListTable() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const supabase = createClient()

    try {
      // Get profiles with auth user email
      const { data: profiles } = await supabase
        .from('profiles')
        .select(`
          id,
          auth_user_id,
          name,
          onboarding_complete,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!profiles) return

      // Fetch runs and goals count for each user
      const usersWithStats = await Promise.all(
        profiles.map(async (profile) => {
          const { count: runsCount } = await supabase
            .from('runs')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id)

          const { count: goalsCount } = await supabase
            .from('goals')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id)

          const { data: lastRun } = await supabase
            .from('runs')
            .select('completed_at')
            .eq('profile_id', profile.id)
            .order('completed_at', { ascending: false })
            .limit(1)
            .single()

          // Try to get email from auth metadata (if available)
          let email = 'user@example.com' // Default
          try {
            const { data: { users } } = await supabase.auth.admin.listUsers()
            const authUser = users?.find(u => u.id === profile.auth_user_id)
            if (authUser?.email) {
              email = authUser.email
            }
          } catch {
            // If we can't access auth.users (no service role), use placeholder
            email = `user-${profile.id.slice(0, 8)}@***.com`
          }

          return {
            id: profile.id,
            email,
            name: profile.name,
            onboarding_complete: profile.onboarding_complete,
            created_at: profile.created_at,
            runs_count: runsCount || 0,
            goals_count: goalsCount || 0,
            last_activity: lastRun?.completed_at || null,
          }
        })
      )

      setUsers(usersWithStats)
    } catch (error) {
      console.error('[UserListTable] Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Loading users...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Users</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Onboarding</th>
                <th className="pb-3 font-medium text-right">Runs</th>
                <th className="pb-3 font-medium text-right">Goals</th>
                <th className="pb-3 font-medium">Last Activity</th>
                <th className="pb-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div>
                      <div className="font-medium">{user.name || 'Anonymous'}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="py-3">
                    {user.onboarding_complete ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 text-right font-medium">{user.runs_count}</td>
                  <td className="py-3 text-right font-medium">{user.goals_count}</td>
                  <td className="py-3 text-xs text-gray-500">
                    {user.last_activity
                      ? new Date(user.last_activity).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="py-3 text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
