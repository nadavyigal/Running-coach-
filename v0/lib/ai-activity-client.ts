import { z } from "zod"

export const AiActivityResultSchema = z.object({
  distanceKm: z.number().positive(),
  durationSeconds: z.number().positive(),
  paceSecondsPerKm: z.number().positive().optional(),
  calories: z.number().positive().optional(),
  notes: z.string().optional(),
  completedAt: z.string().optional(),
  type: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  requestId: z.string().optional(),
  method: z.string().optional(),
  model: z.string().optional(),
  parserVersion: z.string().optional(),
  preprocessing: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  // GPS/Route data
  hasRouteMap: z.boolean().optional(),
  routeType: z.string().optional(),
  gpsCoordinates: z.array(
    z.object({
      lat: z.number(),
      lng: z.number(),
    })
  ).optional(),
  mapImageDescription: z.string().optional(),
})

export type AiActivityResult = z.infer<typeof AiActivityResultSchema>

export class AiActivityAnalysisError extends Error {
  requestId?: string
  errorCode?: string
  status?: number

  constructor(message: string, options?: { requestId?: string; errorCode?: string; status?: number }) {
    super(message)
    this.name = "AiActivityAnalysisError"

    if (typeof options?.requestId === "string") {
      this.requestId = options.requestId
    }
    if (typeof options?.errorCode === "string") {
      this.errorCode = options.errorCode
    }
    if (typeof options?.status === "number") {
      this.status = options.status
    }
  }
}

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
    throw new AiActivityAnalysisError(message, {
      requestId: typeof payload?.requestId === "string" ? payload.requestId : undefined,
      errorCode: typeof payload?.errorCode === "string" ? payload.errorCode : undefined,
      status: response.status,
    })
  }

  // API returns {activity: {...}, confidence: number}
  // Extract the nested activity object
  const activityData = payload.activity
  if (!activityData) {
    throw new Error("No activity data in API response")
  }

  const rawConfidence = payload.confidence
  const normalizedConfidence =
    typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
      ? rawConfidence <= 1
        ? Math.round(rawConfidence * 100)
        : rawConfidence
      : undefined

  const durationSeconds =
    typeof activityData.durationSeconds === "number" && Number.isFinite(activityData.durationSeconds)
      ? activityData.durationSeconds
      : activityData.durationMinutes * 60 // Convert minutes to seconds

  const meta = payload.meta || {}

  // Transform API response format to match our schema
  const transformed = {
    distanceKm: activityData.distance,
    durationSeconds,
    paceSecondsPerKm: activityData.paceSeconds,
    calories: activityData.calories,
    notes: activityData.notes,
    completedAt: activityData.date,
    type: activityData.type,
    confidence: normalizedConfidence,
    requestId: typeof payload.requestId === "string" ? payload.requestId : undefined,
    method: typeof meta.method === "string" ? meta.method : undefined,
    model: typeof meta.model === "string" ? meta.model : undefined,
    parserVersion: typeof meta.parserVersion === "string" ? meta.parserVersion : undefined,
    preprocessing: Array.isArray(meta.preprocessing) ? meta.preprocessing : undefined,
    warnings: Array.isArray(meta.warnings) ? meta.warnings : undefined,
    // GPS/Route data
    hasRouteMap: typeof activityData.hasRouteMap === "boolean" ? activityData.hasRouteMap : undefined,
    routeType: typeof activityData.routeType === "string" ? activityData.routeType : undefined,
    gpsCoordinates: Array.isArray(activityData.gpsCoordinates) ? activityData.gpsCoordinates : undefined,
    mapImageDescription: typeof activityData.mapImageDescription === "string" ? activityData.mapImageDescription : undefined,
  }

  const parsed = AiActivityResultSchema.safeParse(transformed)
  if (!parsed.success) {
    console.error("Schema validation failed:", parsed.error)
    throw new Error("AI response was not in the expected format")
  }

  return parsed.data
}
