'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addDays, format, isBefore, isSameDay, nextMonday, startOfWeek } from 'date-fns'
import { ArrowLeft, Check, HelpCircle, X } from 'lucide-react'

import { type PlanDistanceKey, type PlanTemplate } from '@/lib/plan-templates'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export type TrainingVolumePreference = 'conservative' | 'progressive' | 'high'
export type TrainingDifficultyPreference = 'easy' | 'balanced' | 'challenging'

export interface PlanTemplateWizardResult {
  distanceKey: PlanDistanceKey
  currentRaceTimeSeconds: number
  daysPerWeek: number
  availableDays: Weekday[]
  longRunDay: Weekday
  startDate: Date
  basePlanLengthWeeks: number
  raceDate: Date
  trainingVolume: TrainingVolumePreference
  difficulty: TrainingDifficultyPreference
}

const WIZARD_TOTAL_STEPS = 9

const DISTANCE_CHIPS: Array<{ key: PlanDistanceKey; label: string }> = [
  { key: '5k', label: '5K' },
  { key: '10k', label: '10k' },
  { key: 'half-marathon', label: 'Half Marathon' },
  { key: 'marathon', label: 'Marathon' },
]

const WEEKDAYS: Array<{ key: Weekday; label: string; weekdayIndex: number }> = [
  { key: 'Mon', label: 'Monday', weekdayIndex: 1 },
  { key: 'Tue', label: 'Tuesday', weekdayIndex: 2 },
  { key: 'Wed', label: 'Wednesday', weekdayIndex: 3 },
  { key: 'Thu', label: 'Thursday', weekdayIndex: 4 },
  { key: 'Fri', label: 'Friday', weekdayIndex: 5 },
  { key: 'Sat', label: 'Saturday', weekdayIndex: 6 },
  { key: 'Sun', label: 'Sunday', weekdayIndex: 0 },
]

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatTimeHms(totalSeconds: number) {
  const seconds = clampNumber(Math.round(totalSeconds), 0, 99 * 3600)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function getDefaultRaceTimeSeconds(distanceKey: PlanDistanceKey) {
  switch (distanceKey) {
    case '5k':
      return 30 * 60
    case '10k':
      return 58 * 60
    case 'half-marathon':
      return 2 * 60 * 60
    case 'marathon':
      return 4 * 60 * 60 + 30 * 60
    default:
      return 60 * 60
  }
}

function getDefaultAvailableDays(daysPerWeek: number): Weekday[] {
  type PatternKey = 2 | 3 | 4 | 5 | 6

  const patterns: Record<PatternKey, Weekday[]> = {
    2: ['Wed', 'Sat'],
    3: ['Mon', 'Wed', 'Fri'],
    4: ['Mon', 'Wed', 'Fri', 'Sun'],
    5: ['Mon', 'Tue', 'Thu', 'Fri', 'Sun'],
    6: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sun'],
  }

  const key = clampNumber(daysPerWeek, 2, 6) as PatternKey
  return patterns[key]
}

function getWeekdayLabel(day: Weekday) {
  return WEEKDAYS.find((d) => d.key === day)?.label || day
}

function getWeekdayIndex(day: Weekday): number {
  return WEEKDAYS.find((d) => d.key === day)?.weekdayIndex ?? 1
}

function getRaceWeekStart(startDate: Date, basePlanLengthWeeks: number) {
  const endDate = addDays(startDate, basePlanLengthWeeks * 7)
  return startOfWeek(endDate, { weekStartsOn: 1 })
}

function buildRaceDayOptions(raceWeekStart: Date) {
  return WEEKDAYS.map((d) => ({
    day: d.key,
    label: d.label,
    date: addDays(raceWeekStart, d.weekdayIndex === 0 ? 6 : d.weekdayIndex - 1),
  }))
}

const WHEEL_ITEM_HEIGHT = 48
const WHEEL_PADDING_ITEMS = 2

function WheelColumn(props: {
  value: number
  min: number
  max: number
  padTo2?: boolean
  suffix?: string
  ariaLabel: string
  onChange: (value: number) => void
}) {
  const { value, min, max, padTo2, suffix, ariaLabel, onChange } = props
  const ref = useRef<HTMLDivElement | null>(null)
  const scrollTimeout = useRef<number | null>(null)

  const items = useMemo(() => {
    const values = Array.from({ length: max - min + 1 }, (_, idx) => min + idx)
    return [
      ...Array.from({ length: WHEEL_PADDING_ITEMS }).map(() => null),
      ...values,
      ...Array.from({ length: WHEEL_PADDING_ITEMS }).map(() => null),
    ]
  }, [min, max])

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const targetIndex = items.findIndex((item) => item === value)
    if (targetIndex === -1) return
    container.scrollTo({ top: targetIndex * WHEEL_ITEM_HEIGHT, behavior: 'auto' })
  }, [items, value])

  const handleScroll = () => {
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current)
    scrollTimeout.current = window.setTimeout(() => {
      const container = ref.current
      if (!container) return
      const rawIndex = Math.round(container.scrollTop / WHEEL_ITEM_HEIGHT)
      const item = items[rawIndex]
      if (typeof item === 'number' && item !== value) {
        onChange(item)
      }
      container.scrollTo({ top: rawIndex * WHEEL_ITEM_HEIGHT, behavior: 'smooth' })
    }, 80)
  }

  return (
    <div className="relative w-24">
      <div
        ref={ref}
        aria-label={ariaLabel}
        role="listbox"
        className="h-60 overflow-y-auto no-scrollbar snap-y snap-mandatory"
        onScroll={handleScroll}
      >
        {items.map((item, idx) => {
          const isSelected = item === value
          return (
            <button
              key={`${ariaLabel}-${idx}`}
              type="button"
              className={cn(
                'w-full h-12 snap-center flex items-center justify-center text-2xl transition',
                item === null ? 'opacity-0 pointer-events-none' : 'opacity-40',
                isSelected && 'opacity-100 font-semibold text-white'
              )}
              onClick={() => {
                if (typeof item !== 'number') return
                onChange(item)
                ref.current?.scrollTo({ top: idx * WHEEL_ITEM_HEIGHT, behavior: 'smooth' })
              }}
            >
              {typeof item === 'number'
                ? `${padTo2 ? String(item).padStart(2, '0') : item}${suffix ?? ''}`
                : '00'}
            </button>
          )
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 rounded-xl border border-white/10 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-neutral-950 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-neutral-950 to-transparent" />
    </div>
  )
}

function SelectCard(props: {
  selected: boolean
  onClick: () => void
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  const { selected, onClick, title, subtitle, right } = props
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <Card
        className={cn(
          'relative overflow-hidden border text-white rounded-3xl px-6 py-5 flex items-center justify-between bg-gradient-to-br shadow-lg transition-all duration-200',
          selected
            ? 'border-emerald-400/50 ring-2 ring-inset ring-emerald-400/20 from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent'
            : 'border-white/10 hover:border-white/20 from-white/[0.03] to-transparent hover:from-white/[0.05]'
        )}
      >
        <div className="flex-1">
          <div className="text-lg font-medium">{title}</div>
          {subtitle && <div className="text-sm text-white/50 mt-1.5 leading-relaxed">{subtitle}</div>}
        </div>
        {right && <div className="ml-4">{right}</div>}
      </Card>
    </button>
  )
}

export function PlanSetupWizard(props: {
  template: PlanTemplate
  initialDaysPerWeek?: number
  onBackToDetail: () => void
  onClose: () => void
  onDistanceChange?: (distanceKey: PlanDistanceKey) => void
  onSubmit: (result: PlanTemplateWizardResult) => void | Promise<void>
}) {
  const { template, initialDaysPerWeek, onBackToDetail, onClose, onDistanceChange, onSubmit } = props
  const [step, setStep] = useState(1)

  const [distanceKey, setDistanceKey] = useState<PlanDistanceKey>(template.distanceKey)
  const [timeSeeded, setTimeSeeded] = useState(true)

  const defaultSeconds = useMemo(() => getDefaultRaceTimeSeconds(distanceKey), [distanceKey])
  const [hours, setHours] = useState(Math.floor(defaultSeconds / 3600))
  const [minutes, setMinutes] = useState(Math.floor((defaultSeconds % 3600) / 60))
  const [seconds, setSeconds] = useState(defaultSeconds % 60)

  const [daysPerWeek, setDaysPerWeek] = useState<number>(clampNumber(initialDaysPerWeek || 3, 2, 6))
  const [availableDays, setAvailableDays] = useState<Weekday[]>(() => getDefaultAvailableDays(daysPerWeek))
  const [longRunDay, setLongRunDay] = useState<Weekday>(() =>
    availableDays.includes('Sat') ? 'Sat' : availableDays.at(-1) ?? 'Sun'
  )

  const [startDate, setStartDate] = useState<Date>(() => new Date())
  const [startPreset, setStartPreset] = useState<'today' | 'tomorrow' | 'monday' | 'custom'>('today')

  const [basePlanLengthWeeks, setBasePlanLengthWeeks] = useState<number>(template.recommendedWeeks)
  const [planLengthMode, setPlanLengthMode] = useState<'preset' | 'custom-weeks' | 'custom-end-date'>('preset')
  const [customWeeks, setCustomWeeks] = useState<number>(template.recommendedWeeks)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null)

  const raceWeekStart = useMemo(
    () => getRaceWeekStart(startDate, basePlanLengthWeeks),
    [startDate, basePlanLengthWeeks]
  )
  const raceOptions = useMemo(() => buildRaceDayOptions(raceWeekStart), [raceWeekStart])
  const [raceDate, setRaceDate] = useState<Date>(() => addDays(raceWeekStart, 5))

  const [trainingVolume, setTrainingVolume] = useState<TrainingVolumePreference>('progressive')
  const [difficulty, setDifficulty] = useState<TrainingDifficultyPreference>('balanced')
  const [showPreferenceEditor, setShowPreferenceEditor] = useState(false)

  useEffect(() => {
    setDistanceKey(template.distanceKey)
  }, [template.distanceKey])

  useEffect(() => {
    if (!timeSeeded) return
    setHours(Math.floor(defaultSeconds / 3600))
    setMinutes(Math.floor((defaultSeconds % 3600) / 60))
    setSeconds(defaultSeconds % 60)
  }, [defaultSeconds, timeSeeded])

  useEffect(() => {
    setAvailableDays((prev) => {
      if (prev.length >= daysPerWeek) return prev
      return getDefaultAvailableDays(daysPerWeek)
    })
  }, [daysPerWeek])

  useEffect(() => {
    if (!availableDays.includes(longRunDay)) {
      setLongRunDay(availableDays.includes('Sat') ? 'Sat' : availableDays.at(-1) ?? 'Sun')
    }
  }, [availableDays, longRunDay])

  useEffect(() => {
    const today = new Date()
    if (startPreset === 'today') {
      setStartDate(today)
    } else if (startPreset === 'tomorrow') {
      setStartDate(addDays(today, 1))
    } else if (startPreset === 'monday') {
      setStartDate(nextMonday(today))
    }
  }, [startPreset])

  useEffect(() => {
    if (planLengthMode === 'custom-weeks') {
      setBasePlanLengthWeeks(clampNumber(customWeeks, 4, 12))
      return
    }
    if (planLengthMode === 'custom-end-date' && customEndDate) {
      const diffDays = Math.max(
        1,
        Math.ceil((customEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      )
      setBasePlanLengthWeeks(clampNumber(Math.ceil(diffDays / 7), 4, 12))
    }
  }, [planLengthMode, customWeeks, customEndDate, startDate])

  useEffect(() => {
    const inWeek = raceOptions.some((o) => isSameDay(o.date, raceDate))
    if (!inWeek) {
      setRaceDate(addDays(raceWeekStart, 5))
    }
  }, [raceOptions, raceWeekStart, raceDate])

  const currentRaceTimeSeconds = hours * 3600 + minutes * 60 + seconds
  const progressPercent = Math.round(((step - 1) / (WIZARD_TOTAL_STEPS - 1)) * 100)

  const startPresetDate = useMemo(() => {
    const today = new Date()
    if (startPreset === 'tomorrow') return addDays(today, 1)
    if (startPreset === 'monday') return nextMonday(today)
    return today
  }, [startPreset])

  const actualWeeks = useMemo(() => {
    const diffDays = Math.max(0, Math.ceil((raceDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    return Math.max(1, Math.ceil((diffDays + 1) / 7))
  }, [raceDate, startDate])

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return currentRaceTimeSeconds > 0
      case 2:
        return daysPerWeek >= 2 && daysPerWeek <= 6
      case 3:
        return availableDays.length >= daysPerWeek
      case 4:
        return availableDays.includes(longRunDay)
      case 5:
        return !isBefore(startDate, addDays(new Date(), -1))
      case 6:
        return basePlanLengthWeeks >= 4 && basePlanLengthWeeks <= 12
      case 7:
        return !!raceDate
      case 8:
        return true
      case 9:
        return true
      default:
        return false
    }
  }, [step, currentRaceTimeSeconds, daysPerWeek, availableDays, longRunDay, startDate, basePlanLengthWeeks, raceDate])

  const handleBack = () => {
    if (step === 1) {
      onBackToDetail()
      return
    }
    setStep((s) => Math.max(1, s - 1))
  }

  const handleContinue = () => {
    if (!canContinue) return
    if (step === 9) {
      void onSubmit({
        distanceKey,
        currentRaceTimeSeconds,
        daysPerWeek,
        availableDays,
        longRunDay,
        startDate,
        basePlanLengthWeeks,
        raceDate,
        trainingVolume,
        difficulty,
      })
      return
    }
    setStep((s) => Math.min(WIZARD_TOTAL_STEPS, s + 1))
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-neutral-950 text-white">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/5 -ml-2" onClick={handleBack}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-1 w-48 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/5 -mr-2" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32">
        {step === 1 ? (
          <div className="pt-2 space-y-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight leading-tight">
                  What&apos;s your estimated <span className="text-emerald-400">current</span> race time?
                </h2>
                <p className="text-white/60 mt-4 leading-relaxed text-[15px]">
                  Choose a time reflective of your <span className="text-emerald-400">current</span> fitness level — don&apos;t use an out of date PB or goal time!
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white/80 hover:bg-white/5" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {DISTANCE_CHIPS.map((chip) => {
                const active = distanceKey === chip.key
                return (
                  <Button
                    key={chip.key}
                    type="button"
                    onClick={() => {
                      setTimeSeeded(true)
                      setDistanceKey(chip.key)
                      onDistanceChange?.(chip.key)
                    }}
                    className={cn(
                      'h-11 rounded-full px-7 shrink-0 text-sm font-medium border transition-all duration-200',
                      active
                        ? 'bg-emerald-400 text-neutral-950 border-emerald-400 shadow-lg shadow-emerald-500/25 hover:bg-emerald-300'
                        : 'bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06] hover:text-white hover:border-white/20'
                    )}
                  >
                    {chip.label}
                  </Button>
                )
              })}
            </div>

            <div className="text-center text-white/60 text-base py-2">
              I can currently run a <span className="text-emerald-400 font-medium">{template.distanceLabel}</span> in{' '}
              <span className="text-white font-semibold">{formatTimeHms(currentRaceTimeSeconds)}</span>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4">
              <WheelColumn
                value={hours}
                min={0}
                max={10}
                suffix="h"
                ariaLabel="Hours"
                onChange={(value) => {
                  setTimeSeeded(false)
                  setHours(value)
                }}
              />
              <div className="text-2xl -mt-1 text-white/40">:</div>
              <WheelColumn
                value={minutes}
                min={0}
                max={59}
                padTo2
                suffix="m"
                ariaLabel="Minutes"
                onChange={(value) => {
                  setTimeSeeded(false)
                  setMinutes(value)
                }}
              />
              <div className="text-2xl -mt-1 text-white/40">:</div>
              <WheelColumn
                value={seconds}
                min={0}
                max={59}
                padTo2
                suffix="s"
                ariaLabel="Seconds"
                onChange={(value) => {
                  setTimeSeeded(false)
                  setSeconds(value)
                }}
              />
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="pt-2 space-y-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold leading-tight">How many days per week would you like to run?</h2>
                <p className="text-white/60 mt-4 leading-relaxed text-[15px]">
                  This should be at most once more than you currently run per week to reduce the risk of injury
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white/80 hover:bg-white/5" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {[2, 3, 4, 5, 6].map((n) => (
                <SelectCard
                  key={n}
                  selected={daysPerWeek === n}
                  onClick={() => setDaysPerWeek(n)}
                  title={`${n} Days`}
                />
              ))}
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="pt-2 space-y-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold leading-tight">Which days are you free to run on?</h2>
                <p className="text-white/60 mt-4 leading-relaxed text-[15px]">
                  Please select every day available to you, spaced throughout the week, so we can choose the most optimal days to run.
                </p>
                <p
                  className={cn(
                    'mt-4 font-medium text-sm',
                    availableDays.length >= daysPerWeek ? 'text-white/50' : 'text-emerald-400'
                  )}
                >
                  Please select at least {daysPerWeek} days to continue
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white/80 hover:bg-white/5" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3.5">
              {WEEKDAYS.map((d) => {
                const selected = availableDays.includes(d.key)
                return (
                  <SelectCard
                    key={d.key}
                    selected={selected}
                    onClick={() => {
                      setAvailableDays((prev) => {
                        if (prev.includes(d.key)) return prev.filter((x) => x !== d.key)
                        return [...prev, d.key]
                      })
                    }}
                    title={d.label}
                    right={
                      selected ? (
                        <div className="h-7 w-7 rounded-full bg-white text-neutral-950 flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="h-7 w-7 rounded-full border border-white/25" />
                      )
                    }
                  />
                )
              })}
            </div>
          </div>
        ) : null}
        {step === 4 ? (
          <div className="pt-2 space-y-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold leading-tight">Which day do you want to do your long runs on?</h2>
                <p className="text-white/60 mt-4 leading-relaxed text-[15px]">Choose one to continue</p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white/80 hover:bg-white/5" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3.5">
              {availableDays
                .slice()
                .sort((a, b) => getWeekdayIndex(a) - getWeekdayIndex(b))
                .map((d) => (
                  <SelectCard
                    key={d}
                    selected={longRunDay === d}
                    onClick={() => setLongRunDay(d)}
                    title={getWeekdayLabel(d)}
                  />
                ))}
            </div>
          </div>
        ) : null}
        {step === 5 ? (
          <div className="pt-2 space-y-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight leading-tight">When do you want to start your plan?</h2>
                <p className="text-white/60 mt-4 leading-relaxed text-[15px]">Pick a start date that suits you best (you can change this later)</p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white/80 hover:bg-white/5" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <button type="button" onClick={() => setStartPreset('today')} className="w-full text-left">
                <Card
                  className={cn(
                    'relative overflow-hidden rounded-3xl border px-6 py-5 text-white shadow-lg transition-all duration-200',
                    startPreset !== 'custom'
                      ? 'border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent ring-1 ring-inset ring-emerald-400/20'
                      : 'border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent hover:border-white/20'
                  )}
                >
                  <div className="text-sm text-white/50 font-medium">{format(startPresetDate, 'MMM d, yyyy')}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">Now</div>
                  <div className="mt-5 flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                    {[
                      { id: 'today', label: 'Today' },
                      { id: 'tomorrow', label: 'Tomorrow' },
                      { id: 'monday', label: 'Monday' },
                    ].map((chip) => (
                      <Button
                        key={chip.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setStartPreset(chip.id as any)
                        }}
                        className={cn(
                          'h-11 rounded-full px-7 shrink-0 text-sm font-medium border transition-all duration-200',
                          startPreset === chip.id
                            ? 'bg-emerald-400 text-neutral-950 border-emerald-400 shadow-lg shadow-emerald-500/25 hover:bg-emerald-300'
                            : 'bg-white/[0.06] text-white/70 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                        )}
                      >
                        {chip.label}
                      </Button>
                    ))}
                  </div>
                </Card>
              </button>

              <SelectCard selected={startPreset === 'custom'} onClick={() => setStartPreset('custom')} title="Custom" />

              {startPreset === 'custom' && (
                <div className="pt-2">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) setStartDate(date)
                    }}
                    disabled={(date) => isBefore(date, addDays(new Date(), -1))}
                    className="rounded-xl bg-white text-neutral-950"
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
        {step === 6 ? (
          <div className="pt-2 space-y-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold leading-tight">How long do you want your plan to be?</h2>
                <p className="text-white/60 mt-4 leading-relaxed text-[15px]">Choose how long you would like your plan to be.</p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white/80 hover:bg-white/5" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {[
                { weeks: 12, recommendation: 'Recommended for longer training time' },
                { weeks: 10, recommendation: 'Recommended for balanced training amount' },
                { weeks: 8, recommendation: 'Recommended for fast-track training' },
              ].map((option) => {
                const optionWeekStart = getRaceWeekStart(startDate, option.weeks)
                const selected = planLengthMode === 'preset' && basePlanLengthWeeks === option.weeks
                return (
                  <SelectCard
                    key={option.weeks}
                    selected={selected}
                    onClick={() => {
                      setPlanLengthMode('preset')
                      setBasePlanLengthWeeks(option.weeks)
                    }}
                    title={`${option.weeks} Weeks`}
                    subtitle={option.recommendation}
                    right={<div className="text-sm text-white/50">{format(optionWeekStart, 'MMM d, yyyy')}</div>}
                  />
                )
              })}

              <SelectCard
                selected={planLengthMode === 'custom-weeks'}
                onClick={() => setPlanLengthMode('custom-weeks')}
                title="Custom Plan Length"
                subtitle="(select any number of weeks)"
              />

              {planLengthMode === 'custom-weeks' && (
                <div className="px-3 py-3 rounded-xl border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Weeks</span>
                    <span className="text-white font-semibold">{clampNumber(customWeeks, 4, 12)}</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={12}
                    value={customWeeks}
                    onChange={(e) => setCustomWeeks(Number(e.target.value))}
                    className="w-full mt-3 accent-emerald-400"
                  />
                  <div className="text-xs text-white/60 mt-2">Max 12 weeks</div>
                </div>
              )}

              <SelectCard
                selected={planLengthMode === 'custom-end-date'}
                onClick={() => setPlanLengthMode('custom-end-date')}
                title="Custom End Date"
                subtitle="(select any end date)"
              />

              {planLengthMode === 'custom-end-date' && (
                <div className="pt-2">
                  <Calendar
                    mode="single"
                    selected={customEndDate || undefined}
                    onSelect={(date) => {
                      if (date) setCustomEndDate(date)
                    }}
                    disabled={(date) => isBefore(date, addDays(startDate, 7))}
                    className="rounded-xl bg-white text-neutral-950"
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
        {step === 7 ? (
          <div className="pt-2 space-y-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold leading-tight">Which day do you want to do your {template.distanceLabel} race on?</h2>
                <p className="text-white/60 mt-4 leading-relaxed text-[15px]">
                  The last run of your training plan will be a {template.distanceLabel} race. Select the day that you want to go and get that personal best!
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white/80 hover:bg-white/5" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3.5">
              {raceOptions.map((option) => (
                <SelectCard
                  key={option.day}
                  selected={isSameDay(raceDate, option.date)}
                  onClick={() => setRaceDate(option.date)}
                  title={option.label}
                  subtitle={format(option.date, 'MMM d, yyyy')}
                />
              ))}
            </div>
          </div>
        ) : null}
        {step === 8 ? (
          <div className="pt-2 space-y-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold leading-tight">Set your training preferences</h2>
                <p className="text-white/60 mt-4 leading-relaxed text-[15px]">
                  We&apos;ve customized your training volume and difficulty for you. You can revisit this later in &apos;Manage Plan&apos;.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white/80 hover:bg-white/5" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <Card className="border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] text-white rounded-3xl shadow-lg">
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-white/50 font-semibold tracking-wide uppercase">TRAINING VOLUME</div>
                    <div className="text-lg font-medium mt-1.5">
                      {trainingVolume === 'high'
                        ? 'High'
                        : trainingVolume === 'conservative'
                          ? 'Conservative'
                          : 'Progressive'}
                    </div>
                  </div>
                  <div className="border-l border-white/10 pl-6">
                    <div className="text-xs text-white/50 font-semibold tracking-wide uppercase">DIFFICULTY</div>
                    <div className="text-lg font-medium mt-1.5">
                      {difficulty === 'challenging'
                        ? 'Challenging'
                        : difficulty === 'easy'
                          ? 'Easy'
                          : 'Balanced'}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="mt-5 w-full text-white/70 hover:bg-white/5 hover:text-white border border-white/10 rounded-2xl h-11"
                  onClick={() => setShowPreferenceEditor((v) => !v)}
                >
                  ✏️ EDIT PREFERENCES
                </Button>

                {showPreferenceEditor && (
                  <div className="mt-6 pt-6 border-t border-white/10 space-y-5">
                    <div className="text-sm text-white/60 font-medium">Training volume</div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'conservative', label: 'Conservative' },
                        { id: 'progressive', label: 'Progressive' },
                        { id: 'high', label: 'High' },
                      ].map((v) => (
                        <Button
                          key={v.id}
                          type="button"
                          onClick={() => setTrainingVolume(v.id as TrainingVolumePreference)}
                          className={cn(
                            'rounded-2xl h-11 text-sm font-medium transition-all duration-200',
                            trainingVolume === v.id
                              ? 'bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/25'
                              : 'bg-white/[0.06] text-white/80 hover:bg-white/10 hover:text-white border border-white/10'
                          )}
                        >
                          {v.label}
                        </Button>
                      ))}
                    </div>

                    <div className="text-sm text-white/60 font-medium pt-3">Difficulty</div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'easy', label: 'Easy' },
                        { id: 'balanced', label: 'Balanced' },
                        { id: 'challenging', label: 'Challenging' },
                      ].map((v) => (
                        <Button
                          key={v.id}
                          type="button"
                          onClick={() => setDifficulty(v.id as TrainingDifficultyPreference)}
                          className={cn(
                            'rounded-2xl h-11 text-sm font-medium transition-all duration-200',
                            difficulty === v.id
                              ? 'bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/25'
                              : 'bg-white/[0.06] text-white/80 hover:bg-white/10 hover:text-white border border-white/10'
                          )}
                        >
                          {v.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : null}
        {step === 9 ? (
          <div className="pt-2 space-y-8">
            <div>
              <h2 className="text-3xl font-semibold leading-tight">Your plan is nearly ready</h2>
            </div>

            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/30">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">{distanceKey === '5k' ? '5K' : distanceKey === '10k' ? '10K' : distanceKey === 'half-marathon' ? '13.1' : distanceKey === 'marathon' ? '26.2' : '10K'}</div>
                    <div className="text-xs text-white/80 mt-1 tracking-wider">
                      {distanceKey === 'half-marathon' ? 'HALF' : distanceKey === 'marathon' ? 'FULL' : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center mt-6 space-y-2">
                <div className="text-2xl font-semibold">{template.name}</div>
                <div className="text-white/60 text-base flex items-center justify-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {actualWeeks} weeks
                  </span>
                  <span className="text-white/30">•</span>
                  <span>{template.distanceKm.toFixed(1)} km</span>
                </div>
                <div className="text-white/60 text-base flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {format(raceDate, 'EEE, MMM d, yyyy')}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-white/60 text-sm font-medium">Your plan is customized based on these details</div>
              <ul className="space-y-3.5">
                <li className="flex items-start gap-3 text-white/80 text-[15px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0"></div>
                  <span>Your estimated current {template.distanceLabel} time is <span className="text-white font-medium">{formatTimeHms(currentRaceTimeSeconds)}</span></span>
                </li>
                <li className="flex items-start gap-3 text-white/80 text-[15px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0"></div>
                  <span>You are available to run on <span className="text-white font-medium">{availableDays.map(getWeekdayLabel).join(', ')}</span></span>
                </li>
                <li className="flex items-start gap-3 text-white/80 text-[15px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0"></div>
                  <span>You&apos;d like your long run to be on <span className="text-white font-medium">{getWeekdayLabel(longRunDay)}</span></span>
                </li>
                <li className="flex items-start gap-3 text-white/80 text-[15px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0"></div>
                  <span>Your plan starts on <span className="text-white font-medium">{format(startDate, 'EEE, MMM d, yyyy')}</span></span>
                </li>
              </ul>
            </div>
          </div>
        ) : null}
        <div className="hidden pt-10 text-center text-white/70">
          Wizard UI loading…
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-6 pb-6 pt-4 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent">
        <Button
          type="button"
          className={cn(
            'w-full h-14 rounded-2xl font-semibold text-base shadow-xl transition-all duration-200',
            canContinue
              ? 'bg-white text-neutral-950 hover:bg-white/95 hover:shadow-2xl hover:scale-[1.02] active:scale-100'
              : 'bg-white/10 text-white/40 cursor-not-allowed'
          )}
          onClick={handleContinue}
          disabled={!canContinue}
        >
          {step === 9 ? 'Generate my plan' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
