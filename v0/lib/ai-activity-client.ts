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

  const parsed = AiActivityResultSchema.safeParse(payload?.data ?? payload)
  if (!parsed.success) {
    throw new Error("AI response was not in the expected format")
  }

  return parsed.data
}
