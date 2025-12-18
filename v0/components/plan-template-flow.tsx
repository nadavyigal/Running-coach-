'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Info, Loader2, X } from 'lucide-react'

import { PLAN_TEMPLATES, type PlanTemplateFilter, type PlanTemplate } from '@/lib/plan-templates'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { dbUtils } from '@/lib/dbUtils'
import { regenerateTrainingPlan } from '@/lib/plan-regeneration'
import { PlanSetupWizard, type PlanTemplateWizardResult, type Weekday } from '@/components/plan-setup-wizard'
import type { Goal } from '@/lib/db'

type FlowView = 'catalog' | 'detail' | 'wizard'

interface PlanTemplateFlowProps {
  isOpen: boolean
  onClose: () => void
  userId: number
  onCompleted?: () => void
}

const FILTERS: Array<{ id: PlanTemplateFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: '5k/10k', label: '5k/10k' },
  { id: 'half-marathon', label: 'Half Marathon' },
  { id: 'marathon', label: 'Marathon' },
]

function formatDistanceKm(distanceKm: number) {
  if (Number.isInteger(distanceKm)) return `${distanceKm.toFixed(1)} km`
  return `${distanceKm.toFixed(1)} km`
}

function PlanBadge({ label, accentClassName }: { label: string; accentClassName: string }) {
  return (
    <div
      className={cn(
        'h-14 w-14 shrink-0 rounded-2xl border-2 bg-white/5 flex items-center justify-center',
        accentClassName
      )}
    >
      <div className="text-sm font-semibold">{label}</div>
    </div>
  )
}

function CatalogView(props: {
  filter: PlanTemplateFilter
  onFilterChange: (filter: PlanTemplateFilter) => void
  templates: PlanTemplate[]
  onClose: () => void
  onSelectTemplate: (template: PlanTemplate) => void
}) {
  const { filter, onFilterChange, templates, onClose, onSelectTemplate } = props

  return (
    <div className="h-[100dvh] flex flex-col bg-neutral-950 text-white">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <h1 className="mt-4 text-3xl font-semibold">All plans</h1>
      </div>

      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={cn(
                'rounded-full h-10 px-5 shrink-0',
                filter === f.id
                  ? 'bg-emerald-400 text-neutral-950 hover:bg-emerald-300'
                  : 'bg-white/10 text-white hover:bg-white/15'
              )}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              'cursor-pointer border bg-white/5 text-white hover:bg-white/10 transition',
              template.accentClassName
            )}
            onClick={() => onSelectTemplate(template)}
          >
            <CardContent className="p-4 flex items-center gap-4 overflow-hidden">
              <PlanBadge label={template.distanceLabel} accentClassName={template.accentClassName} />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold truncate">{template.name}</div>
                <div className="text-sm text-white/70">
                  {template.recommendedWeeks} weeks • {formatDistanceKm(template.distanceKm)}
                </div>
                {template.isComingSoon && (
                  <div className="text-xs text-white/60 mt-1">Coming soon</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DetailView(props: {
  template: PlanTemplate
  onBack: () => void
  onClose: () => void
  onCreate: () => void
  onLearnMore: () => void
}) {
  const { template, onBack, onClose, onCreate, onLearnMore } = props

  return (
    <div className="h-[100dvh] flex flex-col bg-neutral-950 text-white">
      <div className="relative h-[44vh] min-h-[260px]">
        <Image
          src={template.heroImageSrc}
          alt=""
          fill
          className="object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/55 to-neutral-950" />

        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Button variant="secondary" size="icon" className="bg-white/90 text-black" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="absolute inset-x-0 bottom-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <PlanBadge label={template.distanceLabel} accentClassName={template.accentClassName} />
            <div className="text-center">
              <div className="text-3xl font-semibold">{template.name}</div>
              <div className="text-white/70 mt-1">
                {template.recommendedWeeks} weeks • {template.distanceLabel}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pt-2 pb-6 flex flex-col">
        <p className="text-lg text-white/80 leading-relaxed">{template.description}</p>

        <div className="mt-auto space-y-3 pt-8">
          <Button
            type="button"
            className="w-full h-12 rounded-xl bg-white text-neutral-950 hover:bg-white/90"
            onClick={onCreate}
            disabled={template.isComingSoon}
          >
            {template.isComingSoon ? 'Coming soon' : 'Create this plan'}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-xl border-white/30 bg-transparent text-white hover:bg-white/10"
            onClick={onLearnMore}
          >
            <Info className="h-4 w-4 mr-2" />
            Learn more
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PlanTemplateFlow({ isOpen, onClose, userId, onCompleted }: PlanTemplateFlowProps) {
  const { toast } = useToast()
  const [view, setView] = useState<FlowView>('catalog')
  const [filter, setFilter] = useState<PlanTemplateFilter>('all')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [initialDaysPerWeek, setInitialDaysPerWeek] = useState<number | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)

  const selectedTemplate = useMemo(
    () => PLAN_TEMPLATES.find((t) => t.id === selectedTemplateId) || null,
    [selectedTemplateId]
  )

  const filteredTemplates = useMemo(() => {
    if (filter === 'all') return PLAN_TEMPLATES
    return PLAN_TEMPLATES.filter((t) => t.filter === filter)
  }, [filter])

  useEffect(() => {
    if (!isOpen) return
    dbUtils.getUserById(userId).then((user) => {
      if (user?.daysPerWeek) setInitialDaysPerWeek(user.daysPerWeek)
    }).catch(() => {})
  }, [isOpen, userId])

  const handleClose = () => {
    setView('catalog')
    setFilter('all')
    setSelectedTemplateId(null)
    onClose()
  }

  const handleSelectTemplate = (template: PlanTemplate) => {
    setSelectedTemplateId(template.id)
    setView('detail')
  }

  const handleLearnMore = () => {
    if (!selectedTemplate) return
    toast({
      title: selectedTemplate.name,
      description: selectedTemplate.description,
    })
  }

  const handleCreate = () => {
    setView('wizard')
  }

  const selectTrainingDays = (availableDays: Weekday[], daysPerWeek: number, longRunDay: Weekday): Weekday[] => {
    const dayToIndex: Record<Weekday, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }
    const indexToDay: Record<number, Weekday> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }

    const availableSet = new Set(availableDays)
    const desired = Math.min(Math.max(daysPerWeek, 2), 6)
    const chosen = new Set<Weekday>()

    if (availableSet.has(longRunDay)) chosen.add(longRunDay)

    const candidates = availableDays
      .slice()
      .sort((a, b) => dayToIndex[a] - dayToIndex[b])

    const circularDistance = (a: number, b: number) => {
      const diff = Math.abs(a - b)
      return Math.min(diff, 7 - diff)
    }

    while (chosen.size < desired) {
      let best: Weekday | null = null
      let bestScore = -1

      for (const candidate of candidates) {
        if (chosen.has(candidate)) continue
        const candidateIndex = dayToIndex[candidate]
        const distances = Array.from(chosen).map((d) => circularDistance(candidateIndex, dayToIndex[d]))
        const minDistance = distances.length ? Math.min(...distances) : 7
        if (minDistance > bestScore) {
          bestScore = minDistance
          best = candidate
        }
      }

      if (!best) break
      chosen.add(best)
    }

    return Array.from(chosen)
      .map((d) => ({ d, idx: dayToIndex[d] }))
      .sort((a, b) => a.idx - b.idx)
      .map((x) => indexToDay[x.idx])
  }

  const formatTimeHms = (totalSeconds: number) => {
    const seconds = Math.max(0, Math.round(totalSeconds))
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const handleWizardSubmit = async (result: PlanTemplateWizardResult) => {
    if (!selectedTemplate) return
    if (isGenerating) return
    setIsGenerating(true)

    let createdGoalId: number | null = null
    try {
      // 1) Update user preferences (safe, optional)
      const trainingDays = selectTrainingDays(result.availableDays, result.daysPerWeek, result.longRunDay)
      const planPreferences = {
        availableDays: result.availableDays,
        trainingDays,
        longRunDay: result.longRunDay,
        startDate: result.startDate,
        basePlanLengthWeeks: result.basePlanLengthWeeks,
        raceDate: result.raceDate,
        trainingVolume: result.trainingVolume,
        difficulty: result.difficulty,
        currentRaceTimeSeconds: result.currentRaceTimeSeconds,
      }

      const diffDays = Math.max(
        0,
        Math.ceil((result.raceDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24))
      )
      const totalWeeks = Math.min(16, Math.max(1, Math.ceil((diffDays + 1) / 7)))

      await dbUtils.updateUser(userId, {
        daysPerWeek: result.daysPerWeek,
        planPreferences,
      })

      // 2) Create a minimal SMART goal (client-side)
      const baselineSeconds = Math.max(60, Math.round(result.currentRaceTimeSeconds))
      const improvementFactor =
        result.difficulty === 'easy' ? 0.98 : result.difficulty === 'challenging' ? 0.92 : 0.95
      const targetSeconds = Math.max(60, Math.round(baselineSeconds * improvementFactor))

      const goalData: Partial<Goal> = {
        userId,
        title: selectedTemplate.name,
        goalType: 'time_improvement',
        category: selectedTemplate.goalCategory,
        targetValue: targetSeconds,
        specificTarget: {
          metric: selectedTemplate.metric,
          value: targetSeconds,
          unit: 'seconds',
          description: `Run ${selectedTemplate.distanceLabel} in ${formatTimeHms(targetSeconds)}`,
        },
        timeBound: {
          startDate: result.startDate,
          deadline: result.raceDate,
          milestoneSchedule: [25, 50, 75, 100],
        } as any,
        baselineValue: baselineSeconds,
        relevantContext: `Plan template: ${selectedTemplate.name}. Current ${selectedTemplate.distanceLabel} time: ${formatTimeHms(baselineSeconds)}. Runs/week: ${result.daysPerWeek}. Available: ${result.availableDays.join(', ')}. Long run: ${result.longRunDay}. Volume: ${result.trainingVolume}. Difficulty: ${result.difficulty}.`,
      }

      const completedGoal = await dbUtils.autoCompleteGoalFields(goalData as any, userId)
      const validation = dbUtils.validateSMARTGoal(completedGoal)
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      createdGoalId = await dbUtils.createGoal(completedGoal)
      const createdGoal = await dbUtils.getGoal(createdGoalId)
      if (!createdGoal) throw new Error('Goal was created but could not be loaded')

      await dbUtils.setPrimaryGoal(userId, createdGoalId)

      // 3) Generate and save a new training plan for this goal
      const plan = await regenerateTrainingPlan(userId, createdGoal, {
        startDate: result.startDate,
        raceDate: result.raceDate,
        totalWeeks,
        targetDistance: selectedTemplate.distanceKey,
        planPreferences,
      })

      if (!plan) {
        throw new Error('Training plan could not be generated')
      }

      toast({
        title: 'Plan created',
        description: 'Your training plan is ready.',
      })

      onCompleted?.()
      handleClose()

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('navigate-to-plan'))
      }
    } catch (error) {
      if (createdGoalId) {
        try {
          await dbUtils.deleteGoal(createdGoalId)
        } catch {
          // ignore rollback failures
        }
      }

      toast({
        title: 'Failed to create plan',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : handleClose())}>
      <DialogContent className="max-w-md h-[100dvh] p-0 overflow-hidden border-0">
        {view === 'catalog' && (
          <CatalogView
            filter={filter}
            onFilterChange={setFilter}
            templates={filteredTemplates}
            onClose={handleClose}
            onSelectTemplate={handleSelectTemplate}
          />
        )}

        {view === 'detail' && selectedTemplate && (
          <DetailView
            template={selectedTemplate}
            onBack={() => setView('catalog')}
            onClose={handleClose}
            onCreate={handleCreate}
            onLearnMore={handleLearnMore}
          />
        )}

        {view === 'wizard' && selectedTemplate && (
          <div className="relative">
            <PlanSetupWizard
              template={selectedTemplate}
              initialDaysPerWeek={initialDaysPerWeek}
              onBackToDetail={() => setView('detail')}
              onClose={handleClose}
              onDistanceChange={(distanceKey) => {
                const nextTemplate = PLAN_TEMPLATES.find(
                  (t) => t.distanceKey === distanceKey && !t.isComingSoon
                )
                if (nextTemplate && nextTemplate.id !== selectedTemplateId) {
                  setSelectedTemplateId(nextTemplate.id)
                }
              }}
              onSubmit={handleWizardSubmit}
            />

            {isGenerating && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center space-y-3 px-6">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-white" />
                  <div className="text-white font-semibold">Generating your plan…</div>
                  <div className="text-white/70 text-sm">This can take up to a minute. Don’t close the app.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
