'use client';

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { AlertCircle, Calculator, RotateCcw, Save, ArrowLeft, Upload } from 'lucide-react';
import { dbUtils } from '@/lib/dbUtils';
import { type PlanSetupPreferences, type User } from '@/lib/db';
import {
  validateUserData,
  calculateMaxHR,
  estimateVO2MaxFromVDOT,
  formatPace,
  parsePace,
  METRIC_DESCRIPTIONS,
} from '@/lib/userDataValidation';
import { calculateVDOT } from '@/lib/pace-zones';
import { cn } from '@/lib/utils';
import { HistoricRunUploadModal } from '@/components/profile/historic-run-upload-modal';
import { HistoricRunCard } from '@/components/profile/historic-run-card';
import { type HistoricRunEntry } from '@/components/profile/types';

interface UserDataSettingsProps {
  userId: number;
  onBack: () => void;
  onSave?: () => void;
}

type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

const WEEKDAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
  { key: 'Fri', label: 'Friday' },
  { key: 'Sat', label: 'Saturday' },
  { key: 'Sun', label: 'Sunday' },
];

const EXPERIENCE_OPTIONS: Array<{
  value: User['experience'];
  title: string;
  description: string;
}> = [
  { value: 'beginner', title: 'Beginner', description: 'New to running or returning after time off' },
  { value: 'intermediate', title: 'Intermediate', description: 'Run regularly with steady weekly volume' },
  { value: 'advanced', title: 'Advanced', description: 'Experienced runner with specific goals' },
];

const RACE_DISTANCE_OPTIONS = [
  { value: 5, label: '5K' },
  { value: 10, label: '10K' },
  { value: 21.1, label: 'Half Marathon' },
  { value: 42.2, label: 'Marathon' },
];

const TRAINING_DAY_OPTIONS = [2, 3, 4, 5, 6];

const WHEEL_ITEM_HEIGHT = 48;
const WHEEL_VISIBLE_ITEMS = 5;
const WHEEL_CENTER_OFFSET = Math.floor(WHEEL_VISIBLE_ITEMS / 2);

const STEPS = [
  {
    id: 'profile',
    label: 'Profile',
    title: 'Profile basics',
    description: 'Set your baseline so plans stay realistic.',
  },
  {
    id: 'race',
    label: 'Race',
    title: 'Recent race result',
    description: 'Use a recent effort to calculate training paces.',
  },
  {
    id: 'metrics',
    label: 'Metrics',
    title: 'Physiological metrics',
    description: 'Optional inputs for more precise zones.',
  },
  {
    id: 'history',
    label: 'History',
    title: 'Training history',
    description: 'Add meaningful runs for better context.',
  },
];

const DEFAULT_LONG_RUN_DAY: Weekday = 'Sat';
const WEEKDAY_SET = new Set(WEEKDAYS.map((day) => day.key));

const isWeekday = (value?: string): value is Weekday =>
  Boolean(value && WEEKDAY_SET.has(value as Weekday));

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTimeHms(totalSeconds: number) {
  const seconds = clampNumber(Math.round(totalSeconds), 0, 99 * 3600);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function getDefaultRaceTimeSeconds(distanceKm: number) {
  if (distanceKm === 5) return 30 * 60;
  if (distanceKm === 10) return 58 * 60;
  if (distanceKm === 21.1) return 2 * 60 * 60;
  if (distanceKm === 42.2) return 4 * 60 * 60 + 30 * 60;
  return 60 * 60;
}

function selectTrainingDays(availableDays: Weekday[], daysPerWeek: number, longRunDay: Weekday): Weekday[] {
  const dayToIndex: Record<Weekday, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const availableSet = new Set(availableDays);
  const desired = clampNumber(daysPerWeek, 2, 6);
  const chosen = new Set<Weekday>();

  if (availableSet.has(longRunDay)) chosen.add(longRunDay);

  const candidates = availableDays
    .slice()
    .sort((a, b) => dayToIndex[a] - dayToIndex[b]);

  const circularDistance = (a: number, b: number) => {
    const diff = Math.abs(a - b);
    return Math.min(diff, 7 - diff);
  };

  while (chosen.size < desired) {
    let best: Weekday | null = null;
    let bestScore = -1;

    for (const candidate of candidates) {
      if (chosen.has(candidate)) continue;
      const candidateIndex = dayToIndex[candidate];
      const distances = Array.from(chosen).map((d) => circularDistance(candidateIndex, dayToIndex[d]));
      const minDistance = distances.length ? Math.min(...distances) : 7;
      if (minDistance > bestScore) {
        bestScore = minDistance;
        best = candidate;
      }
    }

    if (!best) break;
    chosen.add(best);
  }

  return Array.from(chosen);
}

function normalizePlanPreferences(planPreferences: PlanSetupPreferences, daysPerWeek: number): PlanSetupPreferences {
  const rawAvailableDays = planPreferences.availableDays ?? WEEKDAYS.map((day) => day.key);
  const availableDays = rawAvailableDays.filter(isWeekday);
  const resolvedAvailableDays = availableDays.length ? availableDays : WEEKDAYS.map((day) => day.key);
  const longRunDay = isWeekday(planPreferences.longRunDay) ? planPreferences.longRunDay : DEFAULT_LONG_RUN_DAY;
  const desiredDays = clampNumber(daysPerWeek || 3, 2, 6);
  const existingTrainingDays = (planPreferences.trainingDays ?? []).filter(isWeekday);
  const trainingDays =
    existingTrainingDays.length === desiredDays && existingTrainingDays.includes(longRunDay)
      ? existingTrainingDays
      : selectTrainingDays(resolvedAvailableDays, desiredDays, longRunDay);

  return {
    ...planPreferences,
    availableDays: resolvedAvailableDays,
    trainingDays,
    longRunDay,
  };
}

function WheelColumn(props: {
  value: number;
  min: number;
  max: number;
  padTo2?: boolean;
  suffix?: string;
  ariaLabel: string;
  onChange: (value: number) => void;
}) {
  const { value, min, max, padTo2, suffix, ariaLabel, onChange } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const scrollTimeout = useRef<number | null>(null);
  const isUserScrolling = useRef(false);
  const isInitialized = useRef(false);

  const items = useMemo(() => {
    const values = Array.from({ length: max - min + 1 }, (_, idx) => min + idx);
    return [
      ...Array.from({ length: WHEEL_CENTER_OFFSET }).map(() => null),
      ...values,
      ...Array.from({ length: WHEEL_CENTER_OFFSET }).map(() => null),
    ];
  }, [min, max]);

  const getScrollTopForValue = (val: number) => {
    const valueIndex = val - min;
    return valueIndex * WHEEL_ITEM_HEIGHT;
  };

  const getValueFromScrollTop = (scrollTop: number) => {
    const valueIndex = Math.round(scrollTop / WHEEL_ITEM_HEIGHT);
    return Math.min(max, Math.max(min, min + valueIndex));
  };

  useEffect(() => {
    if (isInitialized.current) return;
    const container = ref.current;
    if (!container) return;
    container.scrollTop = getScrollTopForValue(value);
    isInitialized.current = true;
  }, [value]);

  useEffect(() => {
    if (!isInitialized.current) return;
    if (isUserScrolling.current) return;
    const container = ref.current;
    if (!container) return;
    const targetScrollTop = getScrollTopForValue(value);
    if (Math.abs(container.scrollTop - targetScrollTop) > 2) {
      container.scrollTop = targetScrollTop;
    }
  }, [value, min]);

  const handleScroll = () => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      const container = ref.current;
      if (!container) return;

      const newValue = getValueFromScrollTop(container.scrollTop);
      const snappedScrollTop = getScrollTopForValue(newValue);

      onChange(newValue);
      container.scrollTo({ top: snappedScrollTop, behavior: 'smooth' });

      setTimeout(() => {
        isUserScrolling.current = false;
      }, 150);
    }, 100);
  };

  return (
    <div className="relative w-20">
      <div
        ref={ref}
        aria-label={ariaLabel}
        role="listbox"
        className="h-60 overflow-y-auto no-scrollbar"
        onScroll={handleScroll}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {items.map((item, idx) => {
          const isSelected = item === value;
          return (
            <button
              key={`${ariaLabel}-${idx}`}
              type="button"
              className={cn(
                'w-full h-12 flex items-center justify-center text-xl transition',
                item === null ? 'opacity-0 pointer-events-none' : 'opacity-40',
                isSelected && 'opacity-100 font-semibold text-white'
              )}
              style={{ scrollSnapAlign: 'center' }}
              onClick={() => {
                if (typeof item !== 'number') return;
                onChange(item);
                const container = ref.current;
                if (container) {
                  container.scrollTo({ top: getScrollTopForValue(item), behavior: 'smooth' });
                }
              }}
            >
              {typeof item === 'number'
                ? `${padTo2 ? String(item).padStart(2, '0') : item}${suffix ?? ''}`
                : ''}
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 rounded-lg border border-white/10 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neutral-950 via-neutral-950/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent" />
    </div>
  );
}

function SelectCard(props: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { selected, onClick, title, subtitle, right } = props;
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div
        className={cn(
          'relative overflow-hidden border rounded-3xl px-6 py-5 flex items-center justify-between shadow-lg transition-all duration-200 bg-gradient-to-br',
          selected
            ? 'border-emerald-400/60 ring-2 ring-inset ring-emerald-400/30 from-emerald-500/[0.18] via-emerald-500/[0.08] to-emerald-500/[0.02] text-white'
            : 'border-white/[0.15] hover:border-white/30 from-white/[0.08] via-white/[0.05] to-white/[0.02] text-white hover:from-white/[0.12]'
        )}
      >
        <div className="flex-1">
          <div className="text-lg font-medium">{title}</div>
          {subtitle && <div className="text-sm text-white/60 mt-1.5 leading-relaxed">{subtitle}</div>}
        </div>
        {right && <div className="ml-4">{right}</div>}
      </div>
    </button>
  );
}

export function UserDataSettings({ userId, onBack, onSave }: UserDataSettingsProps) {
  const [userData, setUserData] = useState<Partial<User>>({});
  const [originalData, setOriginalData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState('profile');
  const [ltPaceInput, setLtPaceInput] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingRunIndex, setEditingRunIndex] = useState<number | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  useEffect(() => {
    if (originalData && Object.keys(originalData).length > 0) {
      const changed = JSON.stringify(userData) !== JSON.stringify(originalData);
      setHasChanges(changed);
    }
  }, [userData, originalData]);

  useEffect(() => {
    setLtPaceInput(userData.lactateThreshold ? formatPace(userData.lactateThreshold) : '');
  }, [userData.lactateThreshold]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const user = await dbUtils.getUser(userId);
      if (user) {
        const hydratedUser: Partial<User> = {
          ...user,
          planPreferences: {
            ...user.planPreferences,
            longRunDay: isWeekday(user.planPreferences?.longRunDay)
              ? user.planPreferences?.longRunDay
              : DEFAULT_LONG_RUN_DAY,
          },
        };
        setUserData(hydratedUser);
        setOriginalData(hydratedUser);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load user data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const validation = validateUserData(userData);
    if (!validation.valid) {
      setErrors(validation.errors);
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
      });
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<User> = { ...userData };

      if (updates.referenceRaceDistance && updates.referenceRaceTime) {
        updates.calculatedVDOT = calculateVDOT(
          updates.referenceRaceDistance,
          updates.referenceRaceTime
        );
      }

      if (updates.planPreferences) {
        const daysPerWeek = typeof updates.daysPerWeek === 'number'
          ? updates.daysPerWeek
          : typeof originalData.daysPerWeek === 'number'
            ? originalData.daysPerWeek
            : 3;
        updates.planPreferences = normalizePlanPreferences(
          updates.planPreferences,
          daysPerWeek
        );
      }

      await dbUtils.updateUser(userId, updates);

      setOriginalData(updates);
      setHasChanges(false);
      setErrors({});

      toast({
        title: 'Saved',
        description: 'Your training data has been updated',
      });

      if (onSave) {
        onSave();
      }

      setTimeout(() => {
        onBack();
      }, 1000);
    } catch (error) {
      console.error('Error saving user data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save user data',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setUserData(originalData);
    setErrors({});
    setHasChanges(false);
  };

  const updateField = (field: keyof User, value: any) => {
    setUserData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const updatePlanPreference = <K extends keyof PlanSetupPreferences>(
    field: K,
    value: PlanSetupPreferences[K]
  ) => {
    setUserData((prev) => ({
      ...prev,
      planPreferences: {
        ...prev.planPreferences,
        [field]: value,
      },
    }));
  };

  const handleCalculateMaxHR = () => {
    if (userData.age) {
      const calculated = calculateMaxHR(userData.age);
      updateField('maxHeartRate', calculated);
      updateField('maxHeartRateSource', 'calculated');
      toast({
        title: 'Calculated',
        description: `Max HR: ${calculated} bpm (based on age ${userData.age})`,
      });
    }
  };

  const handleEstimateVO2Max = () => {
    if (userData.calculatedVDOT) {
      const estimated = estimateVO2MaxFromVDOT(userData.calculatedVDOT);
      updateField('vo2Max', estimated);
      toast({
        title: 'Estimated',
        description: `VO2 Max: ${estimated} ml/kg/min (from VDOT ${userData.calculatedVDOT.toFixed(1)})`,
      });
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  const displayRaceDistance = typeof userData.referenceRaceDistance === 'number'
    ? userData.referenceRaceDistance
    : RACE_DISTANCE_OPTIONS[0].value;
  const raceTimeSeconds = typeof userData.referenceRaceTime === 'number'
    ? userData.referenceRaceTime
    : getDefaultRaceTimeSeconds(displayRaceDistance);
  const raceHours = Math.floor(raceTimeSeconds / 3600);
  const raceMinutes = Math.floor((raceTimeSeconds % 3600) / 60);
  const raceSeconds = raceTimeSeconds % 60;
  const raceDistanceLabel =
    RACE_DISTANCE_OPTIONS.find((option) => option.value === displayRaceDistance)?.label ??
    `${displayRaceDistance}K`;
  const selectedLongRunDay = isWeekday(userData.planPreferences?.longRunDay)
    ? userData.planPreferences?.longRunDay
    : DEFAULT_LONG_RUN_DAY;

  const activeStepIndex = STEPS.findIndex((step) => step.id === activeStep);
  const resolvedStepIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
  const progressPercent = Math.round(((resolvedStepIndex + 1) / STEPS.length) * 100);
  const isLastStep = resolvedStepIndex === STEPS.length - 1;
  const inputClassName =
    'bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:ring-emerald-400/30 focus-visible:ring-offset-0';

  const goNext = () => {
    const nextIndex = Math.min(resolvedStepIndex + 1, STEPS.length - 1);
    setActiveStep(STEPS[nextIndex].id);
  };

  const goBack = () => {
    const prevIndex = Math.max(resolvedStepIndex - 1, 0);
    setActiveStep(STEPS[prevIndex].id);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 'profile':
        return (
          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold leading-tight">Profile basics</h2>
              <p className="text-white/60 text-sm">
                Set the baseline we use for pacing and weekly structure.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="age" className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Age *
              </Label>
              <Input
                id="age"
                type="number"
                min={10}
                max={100}
                value={userData.age ?? ''}
                onChange={(e) => updateField('age', parseInt(e.target.value, 10) || undefined)}
                placeholder="Enter your age"
                className={cn(inputClassName, errors.age && 'border-red-500')}
              />
              {errors.age && <p className="text-xs text-red-400">{errors.age}</p>}
            </div>

            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Running experience *
              </div>
              <div className="space-y-3">
                {EXPERIENCE_OPTIONS.map((option) => (
                  <SelectCard
                    key={option.value}
                    selected={userData.experience === option.value}
                    onClick={() => updateField('experience', option.value)}
                    title={option.title}
                    subtitle={option.description}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="weeklyKm" className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Average weekly distance (km)
              </Label>
              <Input
                id="weeklyKm"
                type="number"
                min={0}
                max={300}
                value={userData.averageWeeklyKm ?? ''}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  const parsed = nextValue === '' ? undefined : parseFloat(nextValue);
                  updateField(
                    'averageWeeklyKm',
                    typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined
                  );
                }}
                placeholder="e.g., 30"
                className={inputClassName}
              />
              <p className="text-xs text-white/50">
                Your typical weekly volume before starting this plan.
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Training days per week *
              </div>
              <div className="space-y-3">
                {TRAINING_DAY_OPTIONS.map((days) => (
                  <SelectCard
                    key={days}
                    selected={userData.daysPerWeek === days}
                    onClick={() => updateField('daysPerWeek', days)}
                    title={`${days} days`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Long run day
              </div>
              <div className="space-y-3">
                {WEEKDAYS.map((day) => (
                  <SelectCard
                    key={day.key}
                    selected={selectedLongRunDay === day.key}
                    onClick={() => updatePlanPreference('longRunDay', day.key)}
                    title={day.label}
                  />
                ))}
              </div>
              <p className="text-xs text-white/50">
                We use this to anchor your longest run of the week.
              </p>
            </div>
          </div>
        );

      case 'race':
        return (
          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold leading-tight">Recent race result</h2>
              <p className="text-white/60 text-sm">
                Use a recent result so we can set accurate training paces.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Race distance
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {RACE_DISTANCE_OPTIONS.map((option) => {
                  const active = displayRaceDistance === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        updateField('referenceRaceDistance', option.value);
                        if (userData.referenceRaceTime === undefined) {
                          updateField('referenceRaceTime', getDefaultRaceTimeSeconds(option.value));
                        }
                      }}
                      className={cn(
                        'h-10 rounded-full px-4 shrink-0 text-sm font-medium border transition-all duration-200',
                        active
                          ? 'bg-emerald-400 text-neutral-950 border-emerald-400 shadow-lg shadow-emerald-500/25 hover:bg-emerald-300'
                          : 'bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06] hover:text-white hover:border-white/20'
                      )}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Race time
              </Label>
              <div className="flex items-center justify-center gap-3 pt-1">
                <WheelColumn
                  value={raceHours}
                  min={0}
                  max={10}
                  suffix="h"
                  ariaLabel="Hours"
                  onChange={(value) => {
                    updateField('referenceRaceTime', value * 3600 + raceMinutes * 60 + raceSeconds);
                  }}
                />
                <div className="text-2xl -mt-1 text-white/40">:</div>
                <WheelColumn
                  value={raceMinutes}
                  min={0}
                  max={59}
                  padTo2
                  suffix="m"
                  ariaLabel="Minutes"
                  onChange={(value) => {
                    updateField('referenceRaceTime', raceHours * 3600 + value * 60 + raceSeconds);
                  }}
                />
                <div className="text-2xl -mt-1 text-white/40">:</div>
                <WheelColumn
                  value={raceSeconds}
                  min={0}
                  max={59}
                  padTo2
                  suffix="s"
                  ariaLabel="Seconds"
                  onChange={(value) => {
                    updateField('referenceRaceTime', raceHours * 3600 + raceMinutes * 60 + value);
                  }}
                />
              </div>
              <div className="text-center text-white/60 text-sm pt-3 leading-relaxed">
                I can currently run a{' '}
                <span className="text-emerald-400 font-medium">{raceDistanceLabel}</span> in{' '}
                <span className="text-white font-semibold">{formatTimeHms(raceTimeSeconds)}</span>
              </div>
            </div>

            {userData.referenceRaceDistance && userData.referenceRaceTime && (
              <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-100">Calculated VDOT</p>
                    <p className="text-xs text-emerald-200/70">Based on your race performance</p>
                  </div>
                  <div className="text-2xl font-bold text-emerald-200">
                    {calculateVDOT(userData.referenceRaceDistance, userData.referenceRaceTime).toFixed(1)}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'metrics':
        return (
          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold leading-tight">Physiological metrics</h2>
              <p className="text-white/60 text-sm">
                Optional data points that refine zones, pacing, and recovery guidance.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="vo2Max" className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    VO2 Max (ml/kg/min)
                  </Label>
                  {userData.calculatedVDOT && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEstimateVO2Max}
                      className="h-7 text-xs gap-1 text-emerald-200 hover:text-emerald-100 hover:bg-white/10"
                    >
                      <Calculator className="h-3 w-3" />
                      Estimate from VDOT
                    </Button>
                  )}
                </div>
                <Input
                  id="vo2Max"
                  type="number"
                  min={20}
                  max={85}
                  value={userData.vo2Max ?? ''}
                  onChange={(e) => updateField('vo2Max', parseFloat(e.target.value) || undefined)}
                  placeholder="e.g., 55"
                  className={cn(inputClassName, errors.vo2Max && 'border-red-500')}
                />
                {errors.vo2Max && <p className="text-xs text-red-400">{errors.vo2Max}</p>}
                <p className="text-xs text-white/50">{METRIC_DESCRIPTIONS.vo2Max.description}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ltPace" className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Lactate threshold pace (min/km)
                </Label>
                <Input
                  id="ltPace"
                  type="text"
                  placeholder="e.g., 4:30"
                  value={ltPaceInput}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setLtPaceInput(nextValue);
                    const parsed = parsePace(nextValue);
                    if (parsed !== null) {
                      updateField('lactateThreshold', parsed);
                    } else if (!nextValue) {
                      updateField('lactateThreshold', undefined);
                    }
                  }}
                  className={cn(inputClassName, errors.lactateThreshold && 'border-red-500')}
                />
                {errors.lactateThreshold && <p className="text-xs text-red-400">{errors.lactateThreshold}</p>}
                <p className="text-xs text-white/50">{METRIC_DESCRIPTIONS.lactateThreshold.description}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ltHR" className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  LT heart rate (bpm)
                </Label>
                <Input
                  id="ltHR"
                  type="number"
                  min={100}
                  max={220}
                  value={userData.lactateThresholdHR ?? ''}
                  onChange={(e) => updateField('lactateThresholdHR', parseInt(e.target.value, 10) || undefined)}
                  placeholder="e.g., 165"
                  className={cn(inputClassName, errors.lactateThresholdHR && 'border-red-500')}
                />
                {errors.lactateThresholdHR && <p className="text-xs text-red-400">{errors.lactateThresholdHR}</p>}
              </div>
            </div>

            <Separator className="bg-white/10" />

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="hrv" className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  HRV baseline (ms)
                </Label>
                <Input
                  id="hrv"
                  type="number"
                  min={10}
                  max={200}
                  value={userData.hrvBaseline ?? ''}
                  onChange={(e) => updateField('hrvBaseline', parseInt(e.target.value, 10) || undefined)}
                  placeholder="e.g., 65"
                  className={cn(inputClassName, errors.hrvBaseline && 'border-red-500')}
                />
                {errors.hrvBaseline && <p className="text-xs text-red-400">{errors.hrvBaseline}</p>}
                <p className="text-xs text-white/50">{METRIC_DESCRIPTIONS.hrvBaseline.description}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="maxHR" className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Max heart rate (bpm)
                  </Label>
                  {userData.age && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCalculateMaxHR}
                      className="h-7 text-xs gap-1 text-emerald-200 hover:text-emerald-100 hover:bg-white/10"
                    >
                      <Calculator className="h-3 w-3" />
                      Calculate from age
                    </Button>
                  )}
                </div>
                <Input
                  id="maxHR"
                  type="number"
                  min={120}
                  max={220}
                  value={userData.maxHeartRate ?? ''}
                  onChange={(e) => {
                    updateField('maxHeartRate', parseInt(e.target.value, 10) || undefined);
                    updateField('maxHeartRateSource', 'user_provided');
                  }}
                  placeholder="e.g., 185"
                  className={cn(inputClassName, errors.maxHeartRate && 'border-red-500')}
                />
                {errors.maxHeartRate && <p className="text-xs text-red-400">{errors.maxHeartRate}</p>}
                <p className="text-xs text-white/50">{METRIC_DESCRIPTIONS.maxHeartRate.description}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="restingHR" className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Resting heart rate (bpm)
                </Label>
                <Input
                  id="restingHR"
                  type="number"
                  min={30}
                  max={100}
                  value={userData.restingHeartRate ?? ''}
                  onChange={(e) => updateField('restingHeartRate', parseInt(e.target.value, 10) || undefined)}
                  placeholder="e.g., 50"
                  className={cn(inputClassName, errors.restingHeartRate && 'border-red-500')}
                />
                {errors.restingHeartRate && <p className="text-xs text-red-400">{errors.restingHeartRate}</p>}
                <p className="text-xs text-white/50">{METRIC_DESCRIPTIONS.restingHeartRate.description}</p>
              </div>
            </div>
          </div>
        );

      case 'history': {
        const historicalRuns = userData.historicalRuns ?? [];
        const canAddRun = historicalRuns.length < 7;

        return (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold leading-tight">Training history</h2>
              <p className="text-white/60 text-sm">
                Add significant past runs to help us understand your training history.
              </p>
            </div>

            {historicalRuns.length > 0 ? (
              <div className="space-y-3">
                {historicalRuns.map((run, index) => (
                  <HistoricRunCard
                    key={`${run.distance}-${run.time}-${index}`}
                    run={{ ...run, date: new Date(run.date) }}
                    onEdit={() => {
                      setEditingRunIndex(index);
                      setShowUploadModal(true);
                    }}
                    onDelete={() => {
                      const filtered = historicalRuns.filter((_, i) => i !== index);
                      updateField('historicalRuns', filtered);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                No historical runs yet. Add up to 7 significant runs for better context.
              </div>
            )}

            <Button
              variant="outline"
              className="w-full border-white/20 text-white/70 hover:bg-white/5 hover:text-white"
              onClick={() => {
                setEditingRunIndex(null);
                setShowUploadModal(true);
              }}
              disabled={!canAddRun}
            >
              <Upload className="h-4 w-4 mr-2" />
              Add Historical Run ({historicalRuns.length}/7)
            </Button>
            {!canAddRun && (
              <p className="text-xs text-white/50 text-center">
                You have reached the maximum of 7 historical runs.
              </p>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  const editingRun: HistoricRunEntry | undefined =
    typeof editingRunIndex === 'number' && userData.historicalRuns?.[editingRunIndex]
      ? { ...userData.historicalRuns[editingRunIndex], date: new Date(userData.historicalRuns[editingRunIndex].date) }
      : undefined;

  const handleSaveHistoricalRun = (runData: HistoricRunEntry) => {
    const currentRuns = userData.historicalRuns ?? [];
    if (typeof editingRunIndex === 'number' && editingRunIndex >= 0 && editingRunIndex < currentRuns.length) {
      const nextRuns = currentRuns.slice();
      nextRuns[editingRunIndex] = runData;
      updateField('historicalRuns', nextRuns);
    } else {
      updateField('historicalRuns', [...currentRuns, runData]);
    }
    setShowUploadModal(false);
    setEditingRunIndex(null);
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setEditingRunIndex(null);
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pb-3 relative z-10" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))' }}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-white/70 hover:bg-white/5 -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex flex-col items-center justify-center -ml-9">
            <div className="text-sm font-semibold">Training Data</div>
            <div className="text-xs text-white/50">Step {resolvedStepIndex + 1} of {STEPS.length}</div>
          </div>
          <div className="w-9" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3">
        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step Navigation Pills */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {STEPS.map((step) => {
            const active = step.id === activeStep;
            return (
              <Button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  'h-9 rounded-full px-4 shrink-0 text-sm font-medium border transition-all duration-200',
                  active
                    ? 'bg-emerald-400 text-neutral-950 border-emerald-400 shadow-lg shadow-emerald-500/25 hover:bg-emerald-300'
                    : 'bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06] hover:text-white hover:border-white/20'
                )}
              >
                {step.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <div className="px-4 pb-3">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>You have unsaved changes</span>
          </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="pb-6">
          {renderStepContent()}
        </div>
      </div>

      {/* Footer with Actions */}
      <div
        className="px-4 pt-3 border-t border-white/[0.08] bg-neutral-950"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
      >
        <div className="flex items-center gap-3 pb-2">
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="text-white/60 hover:text-white hover:bg-white/10"
            size="sm"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {resolvedStepIndex > 0 && (
              <Button
                variant="outline"
                onClick={goBack}
                disabled={saving}
                className="border-white/20 text-white hover:bg-white/5 h-11 px-6"
              >
                Back
              </Button>
            )}
            {isLastStep ? (
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="bg-white text-neutral-950 hover:bg-white/90 h-11 px-6 font-semibold"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neutral-950 mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={saving}
                className="bg-white text-neutral-950 hover:bg-white/90 hover:scale-[1.02] active:scale-100 h-11 px-6 font-semibold transition-all duration-200"
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>

      {showUploadModal && (
        <HistoricRunUploadModal
          {...(editingRun ? { initialRun: editingRun } : {})}
          onClose={handleCloseUploadModal}
          onSave={handleSaveHistoricalRun}
        />
      )}
    </div>
  );
}
