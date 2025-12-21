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
          'relative overflow-hidden border text-white rounded-3xl px-5 py-4 flex items-center justify-between bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.02] shadow-[0_12px_30px_rgba(0,0,0,0.55)] transition-colors',
          selected ? 'border-emerald-300/60 ring-1 ring-inset ring-emerald-300/20' : 'border-white/10 hover:border-white/20'
        )}
      >
        <div>
          <div className="text-lg">{title}</div>
          {subtitle && <div className="text-sm text-white/60 mt-1">{subtitle}</div>}
        </div>
        {right}
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
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-1 w-44 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-300 to-sky-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        {step === 1 ? (
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-4xl font-semibold tracking-tight">
                  What&apos;s your estimated <span className="text-emerald-300">current</span> race time?
                </h2>
                <p className="text-white/70 mt-3 leading-relaxed">
                  Choose a time reflective of your <span className="text-emerald-300">current</span> fitness level — don&apos;t use an out of date PB or goal time!
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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
                      'h-10 rounded-full px-6 shrink-0 text-sm font-medium border transition-colors',
                      active
                        ? 'bg-emerald-400 text-neutral-950 border-emerald-300 shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-300'
                        : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    {chip.label}
                  </Button>
                )
              })}
            </div>

            <div className="text-center text-white/70">
              I can currently run a <span className="text-emerald-300">{template.distanceLabel}</span> in{' '}
              <span className="text-white font-semibold">{formatTimeHms(currentRaceTimeSeconds)}</span>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
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
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold">How many days per week would you like to run?</h2>
                <p className="text-white/70 mt-3">
                  This should be at most once more than you currently run per week to reduce the risk of injury
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
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
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold">Which days are you available to run on?</h2>
                <p className="text-white/70 mt-3">
                  Please select every day available to you, spaced throughout the week, so we can choose the most optimal days to run.
                </p>
                <p
                  className={cn(
                    'mt-3 font-semibold',
                    availableDays.length >= daysPerWeek ? 'text-white/60' : 'text-emerald-300'
                  )}
                >
                  Please select at least {daysPerWeek} days to continue
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
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
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold">Which day do you want to do your long runs on?</h2>
                <p className="text-white/70 mt-3">Choose one to continue</p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
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
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-4xl font-semibold tracking-tight">When do you want to start your plan?</h2>
                <p className="text-white/70 mt-3">Pick a start date that suits you best (you can change this later)</p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
              <button type="button" onClick={() => setStartPreset('today')} className="w-full text-left">
                <Card
                  className={cn(
                    'relative overflow-hidden rounded-3xl border px-5 py-4 text-white shadow-[0_12px_30px_rgba(0,0,0,0.55)]',
                    startPreset !== 'custom'
                      ? 'border-emerald-300/60 bg-emerald-300/5 ring-1 ring-inset ring-emerald-300/20'
                      : 'border-white/10 bg-white/5'
                  )}
                >
                  <div className="text-sm text-white/60">{format(startPresetDate, 'MMM d, yyyy')}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">Now</div>
                  <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
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
                          'h-10 rounded-full px-6 shrink-0 text-sm font-medium border transition-colors',
                          startPreset === chip.id
                            ? 'bg-emerald-400 text-neutral-950 border-emerald-300 shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-300'
                            : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white'
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
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold">How long do you want your plan to be?</h2>
                <p className="text-white/70 mt-3">Choose how long you would like your plan to be.</p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
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
                    right={<div className="text-sm text-white/60">{format(optionWeekStart, 'PPP')}</div>}
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
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold">Which day do you want to do your {template.distanceLabel} race on?</h2>
                <p className="text-white/70 mt-3">
                  The last run of your training plan will be a {template.distanceLabel} race. Select the day that you want to go and get that personal best!
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
              {raceOptions.map((option) => (
                <SelectCard
                  key={option.day}
                  selected={isSameDay(raceDate, option.date)}
                  onClick={() => setRaceDate(option.date)}
                  title={option.label}
                  subtitle={format(option.date, 'PPP')}
                />
              ))}
            </div>
          </div>
        ) : null}
        {step === 8 ? (
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold">Set your training preferences</h2>
                <p className="text-white/70 mt-3">
                  We&apos;ve customized your training volume and difficulty for you. You can revisit this later in Manage Plan.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <Card className="border border-white/10 bg-white/5 text-white rounded-2xl">
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-white/50">TRAINING VOLUME</div>
                    <div className="text-lg">
                      {trainingVolume === 'high'
                        ? 'High'
                        : trainingVolume === 'conservative'
                          ? 'Conservative'
                          : 'Progressive'}
                    </div>
                  </div>
                  <div className="border-l border-white/10 pl-4">
                    <div className="text-xs text-white/50">DIFFICULTY</div>
                    <div className="text-lg">
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
                  className="mt-4 text-white/80 hover:bg-white/10"
                  onClick={() => setShowPreferenceEditor((v) => !v)}
                >
                  Edit preferences
                </Button>

                {showPreferenceEditor && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm text-white/60">Training volume</div>
                    <div className="grid grid-cols-3 gap-2">
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
                            'rounded-xl h-10',
                            trainingVolume === v.id
                              ? 'bg-emerald-400 text-neutral-950'
                              : 'bg-white/10 text-white'
                          )}
                        >
                          {v.label}
                        </Button>
                      ))}
                    </div>

                    <div className="text-sm text-white/60 pt-2">Difficulty</div>
                    <div className="grid grid-cols-3 gap-2">
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
                            'rounded-xl h-10',
                            difficulty === v.id
                              ? 'bg-emerald-400 text-neutral-950'
                              : 'bg-white/10 text-white'
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
          <div className="pt-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold">Your plan is nearly ready</h2>
                <p className="text-white/70 mt-3">Your plan is customized based on these details</p>
              </div>
              <Button variant="ghost" size="icon" className="text-white/70" aria-label="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3 text-white/80">
              <div className="text-2xl font-semibold">{template.name}</div>
              <div className="text-white/70">
                {actualWeeks} weeks • {template.distanceKm.toFixed(1)} km
              </div>
              <div className="text-white/70">{format(raceDate, 'PPP')}</div>

              <div className="text-white/70 pt-2">Your plan is customized based on these details</div>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Your estimated current {template.distanceLabel} time is {formatTimeHms(currentRaceTimeSeconds)}
                </li>
                <li>You are available to run on {availableDays.map(getWeekdayLabel).join(', ')}</li>
                <li>You&apos;d like your long run to be on {getWeekdayLabel(longRunDay)}</li>
                <li>Your plan starts on {format(startDate, 'PPP')}</li>
                <li>Training volume: {trainingVolume}</li>
                <li>Difficulty: {difficulty}</li>
              </ul>
            </div>
          </div>
        ) : null}
        <div className="hidden pt-10 text-center text-white/70">
          Wizard UI loading…
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-neutral-950">
        <Button
          type="button"
          className={cn(
            'w-full h-12 rounded-xl',
            canContinue ? 'bg-white text-neutral-950 hover:bg-white/90' : 'bg-white/20 text-white/50'
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
