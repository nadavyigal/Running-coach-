import { NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { logger } from "@/lib/logger"
import { z } from "zod"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

function isValidImageBuffer(buf: Buffer): boolean {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true
  // PNG: 89 50 4E 47
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true
  // WebP: RIFF....WEBP
  if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return true
  return false
}

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

    // Magic byte validation — ensures the file content matches the declared type
    if (!isValidImageBuffer(buffer)) {
      return NextResponse.json({ success: false, error: "File content does not match a supported image type" }, { status: 400 })
    }

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
