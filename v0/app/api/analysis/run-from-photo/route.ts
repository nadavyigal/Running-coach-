import { NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { logger } from "@/lib/logger"
import { z } from "zod"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "OPENAI_API_KEY is not configured. Add it to use AI analysis."
      }, { status: 503 })
    }

    const data = await req.formData()
    const file = data.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Unsupported file type" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "File is too large" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const extractedRunSchema = z
      .object({
        distanceKm: z.number(),
        durationSeconds: z.number(),
        runType: z.enum(["easy", "tempo", "intervals", "long", "time-trial", "hill", "other"]),
        notes: z.string().optional(),
      })
      .strict()

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: extractedRunSchema,
      prompt: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are analyzing a photo or screenshot of a running activity. Extract the total distance in kilometers, total duration in seconds, classify the run type (easy, tempo, intervals, long, time-trial, hill, other), and provide any relevant notes to prefill a manual run form. Return concise values only.",
            },
            {
              type: "image",
              image: `data:${file.type};base64,${buffer.toString("base64")}`,
            },
          ],
        },
      ],
    })

    return NextResponse.json({ success: true, data: result.object })
  } catch (error) {
    logger.error("Failed to analyze run photo", error)
    return NextResponse.json({ success: false, error: "Failed to analyze image" }, { status: 500 })
  }
}
