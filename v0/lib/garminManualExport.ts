import { formatPaceRange, formatTime } from "@/lib/pace-zones"
import { formatStepDuration, isRepeatBlock, type StructuredWorkout, type WorkoutStep } from "@/lib/workout-steps"

const formatStepLine = (step: WorkoutStep) => {
  const duration = formatStepDuration(step)
  const pace = step.targetPace ? formatPaceRange(step.targetPace) : undefined
  const details = pace ? ` @ ${pace}` : ""
  const description = step.description ? ` - ${step.description}` : ""
  return `${step.type.toUpperCase()}: ${duration}${details}${description}`.trim()
}

export const buildGarminManualWorkoutText = (workout: StructuredWorkout) => {
  const lines: string[] = []

  lines.push(`Workout: ${workout.name}`)
  if (workout.notes) lines.push(`Notes: ${workout.notes}`)
  lines.push(`Total Time (est): ${formatTime(workout.totalDuration)}`)
  lines.push(`Estimated Distance: ${workout.estimatedDistance.toFixed(1)} km`)
  lines.push("")
  lines.push("Steps:")

  if (workout.warmup) {
    lines.push(formatStepLine(workout.warmup))
  }

  if (workout.drills) {
    lines.push(formatStepLine(workout.drills))
  }

  workout.mainSteps.forEach((step) => {
    if (isRepeatBlock(step)) {
      lines.push(`REPEAT ${step.times}x:`)
      step.steps.forEach((repeatStep) => {
        lines.push(`  - ${formatStepLine(repeatStep)}`)
      })
      return
    }
    lines.push(formatStepLine(step))
  })

  if (workout.cooldown) {
    lines.push(formatStepLine(workout.cooldown))
  }

  lines.push("")
  lines.push("Garmin Connect manual setup:")
  lines.push("1) Open Garmin Connect app.")
  lines.push("2) More > Training & Planning > Workouts > Create a Workout > Run.")
  lines.push("3) Add steps in the same order as above, matching durations and targets.")
  lines.push("4) Save the workout and Send to Device (or sync).")

  return lines.join("\n")
}
