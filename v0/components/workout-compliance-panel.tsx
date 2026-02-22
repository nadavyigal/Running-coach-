'use client'

import { useEffect, useMemo, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import type { Run, Workout } from '@/lib/db'
import { dbUtils } from '@/lib/dbUtils'

type ComplianceRow = {
  workout: Workout
  run: Run | null
  plannedKm: number
  actualKm: number
  compliancePct: number
}

function getComplianceColor(compliancePct: number): string {
  if (compliancePct >= 90) return 'text-emerald-600'
  if (compliancePct >= 70) return 'text-amber-600'
  return 'text-rose-600'
}

function getStatusLabel(compliancePct: number, hasRun: boolean): string {
  if (!hasRun) return 'Missed'
  if (compliancePct >= 90) return 'On Target'
  if (compliancePct >= 70) return 'Partial'
  return 'Below Target'
}

export function WorkoutCompliancePanel({ userId }: { userId: number }) {
  const [rows, setRows] = useState<ComplianceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const end = new Date()
        end.setHours(23, 59, 59, 999)
        const start = new Date(end)
        start.setDate(start.getDate() - 27)
        start.setHours(0, 0, 0, 0)

        const [plannedWorkouts, runs] = await Promise.all([
          dbUtils.getWorkoutsForDateRange(userId, start, end, { planScope: 'active' }),
          dbUtils.getRunsByUser(userId),
        ])

        const runByWorkoutId = new Map<number, Run>()
        for (const run of runs) {
          if (typeof run.workoutId === 'number' && !runByWorkoutId.has(run.workoutId)) {
            runByWorkoutId.set(run.workoutId, run)
          }
        }

        const complianceRows: ComplianceRow[] = plannedWorkouts
          .filter((workout) => workout.type !== 'rest')
          .map((workout) => {
            const run = typeof workout.id === 'number' ? runByWorkoutId.get(workout.id) ?? null : null
            const plannedKm = Math.max(0, workout.distance)
            const actualKm = Math.max(0, run?.distance ?? workout.actualDistanceKm ?? 0)
            const compliancePct =
              plannedKm > 0 ? Math.max(0, (actualKm / plannedKm) * 100) : actualKm > 0 ? 100 : 0

            return {
              workout,
              run,
              plannedKm,
              actualKm,
              compliancePct,
            }
          })
          .sort(
            (a, b) =>
              new Date(b.workout.scheduledDate).getTime() - new Date(a.workout.scheduledDate).getTime()
          )

        if (!cancelled) {
          setRows(complianceRows)
        }
      } catch (error) {
        console.warn('[WorkoutCompliancePanel] Failed to load compliance data:', error)
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    const refresh = () => {
      void load()
    }
    window.addEventListener('run-saved', refresh)
    window.addEventListener('garmin-run-synced', refresh)

    return () => {
      cancelled = true
      window.removeEventListener('run-saved', refresh)
      window.removeEventListener('garmin-run-synced', refresh)
    }
  }, [userId])

  const overallCompliance = useMemo(() => {
    if (rows.length === 0) return 0
    const plannedTotal = rows.reduce((sum, row) => sum + row.plannedKm, 0)
    if (plannedTotal <= 0) return 0
    const actualTotal = rows.reduce((sum, row) => sum + row.actualKm, 0)
    return Math.round((actualTotal / plannedTotal) * 100)
  }, [rows])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-foreground/60">Loading compliance...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-foreground/60">No planned workouts in the last 4 weeks.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/60 border-b">
                  <th className="py-2 pe-3">Date</th>
                  <th className="py-2 pe-3">Type</th>
                  <th className="py-2 pe-3">Planned km</th>
                  <th className="py-2 pe-3">Actual km</th>
                  <th className="py-2 pe-3">Compliance %</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const colorClass = getComplianceColor(row.compliancePct)
                  const hasRun = Boolean(row.run || row.actualKm > 0 || row.workout.completed)
                  const rowKey = `${row.workout.id ?? 'workout'}-${new Date(row.workout.scheduledDate).toISOString()}-${row.workout.type}`
                  return (
                    <tr key={rowKey} className="border-b last:border-0">
                      <td className="py-2 pe-3">{new Date(row.workout.scheduledDate).toLocaleDateString()}</td>
                      <td className="py-2 pe-3 capitalize">{row.workout.type}</td>
                      <td className="py-2 pe-3">{row.plannedKm.toFixed(1)}</td>
                      <td className="py-2 pe-3">{row.actualKm.toFixed(1)}</td>
                      <td className={`py-2 pe-3 font-medium ${colorClass}`}>{Math.round(row.compliancePct)}%</td>
                      <td className={`py-2 font-medium ${colorClass}`}>{getStatusLabel(row.compliancePct, hasRun)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-sm font-medium">
          Overall compliance:{' '}
          <span className={getComplianceColor(overallCompliance)}>{Number.isFinite(overallCompliance) ? `${overallCompliance}%` : '0%'}</span>
        </div>
      </CardContent>
    </Card>
  )
}
