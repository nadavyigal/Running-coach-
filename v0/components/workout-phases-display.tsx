"use client"

/**
 * WorkoutPhasesDisplay - Garmin-style workout breakdown component
 *
 * Displays structured workout steps with colored indicators,
 * durations, and pace targets matching Garmin Connect format.
 */

import {
  StructuredWorkout,
  WorkoutStep,
  RepeatBlock,
  isRepeatBlock,
  formatStepDuration
} from "@/lib/workout-steps"
import { formatPace, formatPaceRange, getTargetPace } from "@/lib/pace-zones"

interface WorkoutPhasesDisplayProps {
  workout: StructuredWorkout
  compact?: boolean // For TodayScreen - more condensed view
  darkMode?: boolean // For overlay on colored backgrounds
}

export function WorkoutPhasesDisplay({
  workout,
  compact = false,
  darkMode = false
}: WorkoutPhasesDisplayProps) {
  const subtextColor = darkMode ? "text-white/70" : "text-gray-600"

  return (
    <div className="space-y-3">
      {/* Notes/Summary */}
      {workout.notes && (
        <div className={`text-sm ${subtextColor} font-medium`}>
          {workout.notes}
        </div>
      )}

      {/* Steps Section */}
      <div className={`text-xs font-semibold uppercase tracking-wide ${subtextColor}`}>
        Steps
      </div>

      <div className="space-y-2">
        {/* Warmup */}
        {workout.warmup && (
          <StepCard
            step={workout.warmup}
            compact={compact}
            darkMode={darkMode}
          />
        )}

        {/* Drills */}
        {workout.drills && (
          <StepCard
            step={workout.drills}
            compact={compact}
            darkMode={darkMode}
          />
        )}

        {/* Main Steps */}
        {workout.mainSteps.map((step, index) => (
          isRepeatBlock(step) ? (
            <RepeatBlockCard
              key={index}
              block={step}
              compact={compact}
              darkMode={darkMode}
            />
          ) : (
            <StepCard
              key={index}
              step={step}
              compact={compact}
              darkMode={darkMode}
            />
          )
        ))}

        {/* Cooldown */}
        {workout.cooldown && (
          <StepCard
            step={workout.cooldown}
            compact={compact}
            darkMode={darkMode}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Individual workout step card
 */
interface StepCardProps {
  step: WorkoutStep
  compact?: boolean
  darkMode?: boolean
}

function StepCard({ step, compact = false, darkMode = false }: StepCardProps) {
  const textColor = darkMode ? "text-white" : "text-gray-900"
  const subtextColor = darkMode ? "text-white/70" : "text-gray-600"
  const cardBg = darkMode ? "bg-white/10 backdrop-blur-sm" : "bg-white"
  const borderColor = darkMode ? "border-white/20" : "border-gray-200"

  const stepLabels: Record<string, string> = {
    warmup: "Warm Up",
    run: "Run",
    recover: "Recover",
    cooldown: "Cool Down",
    rest: "Rest",
    drills: "Drills"
  }

  return (
    <div className={`${cardBg} rounded-lg border ${borderColor} overflow-hidden`}>
      <div className="flex">
        {/* Colored left border */}
        <div className={`w-1 ${step.color}`} />

        <div className={`flex-1 ${compact ? "p-3" : "p-4"}`}>
          {/* Step name */}
          <div className={`font-semibold ${textColor} ${compact ? "text-sm" : ""}`}>
            {stepLabels[step.type] || step.type}
          </div>

          {/* Duration */}
          <div className={`${subtextColor} ${compact ? "text-xs" : "text-sm"}`}>
            {formatStepDuration(step)}
          </div>

          {/* Pace target */}
          {step.targetPace && (
            <div className={`${subtextColor} ${compact ? "text-xs" : "text-sm"} mt-1`}>
              <span className="font-medium">Intensity Target</span>
              {" · "}
              {formatPace(getTargetPace(step.targetPace))} min/km
              {!compact && (
                <span className="block text-xs mt-0.5">
                  ({formatPaceRange(step.targetPace)})
                </span>
              )}
            </div>
          )}

          {/* Description (if not compact) */}
          {!compact && step.description && (
            <div className={`${subtextColor} text-xs mt-1 italic`}>
              {step.description}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Repeat block containing multiple steps (for intervals)
 */
interface RepeatBlockCardProps {
  block: RepeatBlock
  compact?: boolean
  darkMode?: boolean
}

function RepeatBlockCard({ block, compact = false, darkMode = false }: RepeatBlockCardProps) {
  const textColor = darkMode ? "text-white" : "text-gray-900"
  const borderColor = darkMode ? "border-white/30" : "border-gray-300"
  const bgColor = darkMode ? "bg-white/5" : "bg-gray-50"

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} ${compact ? "p-2" : "p-3"}`}>
      {/* Repeat header */}
      <div className={`font-semibold ${textColor} ${compact ? "text-sm mb-2" : "mb-3"}`}>
        {block.times} Times
      </div>

      {/* Steps inside the repeat block */}
      <div className="space-y-2 pl-2">
        {block.steps.map((step, index) => (
          <StepCard
            key={index}
            step={step}
            compact={compact}
            darkMode={darkMode}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Compact version for Today screen - single line per step
 */
export function WorkoutPhasesCompact({
  workout,
  darkMode = false
}: {
  workout: StructuredWorkout
  darkMode?: boolean
}) {
  const textColor = darkMode ? "text-white" : "text-gray-900"
  const subtextColor = darkMode ? "text-white/70" : "text-gray-600"
  const bulletColor = darkMode ? "bg-white/60" : "bg-gray-400"
  const activeBulletColor = darkMode ? "bg-white" : "bg-gray-900"

  const formatCompactStep = (step: WorkoutStep): string => {
    const duration = formatStepDuration(step)
    if (step.targetPace) {
      const pace = formatPace(getTargetPace(step.targetPace))
      return `${duration} @ ${pace} min/km`
    }
    return duration
  }

  return (
    <div className="space-y-2">
      {/* Warmup */}
      {workout.warmup && (
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${bulletColor}`} />
          <span className={`text-sm ${subtextColor}`}>
            Warm-up: {formatCompactStep(workout.warmup)}
          </span>
        </div>
      )}

      {/* Main workout - summarized */}
      {workout.mainSteps.map((step, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${activeBulletColor}`} />
          <span className={`text-sm font-semibold ${textColor}`}>
            {isRepeatBlock(step) ? (
              <>
                Main: {step.times}x{formatCompactStep(step.steps[0])}
                {step.steps[1]?.targetPace && (
                  <span className={`font-normal ${subtextColor}`}>
                    {" "}with {formatStepDuration(step.steps[1])} recovery
                  </span>
                )}
              </>
            ) : (
              <>Main: {formatCompactStep(step)}</>
            )}
          </span>
        </div>
      ))}

      {/* Cooldown */}
      {workout.cooldown && (
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${bulletColor}`} />
          <span className={`text-sm ${subtextColor}`}>
            Cool-down: {formatCompactStep(workout.cooldown)}
          </span>
        </div>
      )}
    </div>
  )
}

export default WorkoutPhasesDisplay
