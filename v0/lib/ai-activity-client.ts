import { z } from "zod"

export const AiActivityResultSchema = z.object({
  distanceKm: z.number().positive(),
  durationSeconds: z.number().positive(),
  paceSecondsPerKm: z.number().positive().optional(),
  calories: z.number().positive().optional(),
  notes: z.string().optional(),
  completedAt: z.string().optional(),
  type: z.string().optional(),
})

export type AiActivityResult = z.infer<typeof AiActivityResultSchema>

export async function analyzeActivityImage(file: File): Promise<AiActivityResult> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/ai-activity", {
    method: "POST",
    body: formData,
  })

  const payload = await response.json().catch(() => ({ error: "Invalid response" }))

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Unable to analyze image"
    throw new Error(message)
  }

  // API returns {activity: {...}, confidence: number}
  // Extract the nested activity object
  const activityData = payload.activity
  if (!activityData) {
    throw new Error("No activity data in API response")
  }

  // Transform API response format to match our schema
  const transformed = {
    distanceKm: activityData.distance,
    durationSeconds: activityData.durationMinutes * 60, // Convert minutes to seconds
    paceSecondsPerKm: activityData.paceSeconds,
    calories: activityData.calories,
    notes: activityData.notes,
    completedAt: activityData.date,
    type: activityData.type,
  }

  const parsed = AiActivityResultSchema.safeParse(transformed)
  if (!parsed.success) {
    console.error("Schema validation failed:", parsed.error)
    throw new Error("AI response was not in the expected format")
  }

  return parsed.data
}
