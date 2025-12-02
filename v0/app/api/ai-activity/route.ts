import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

export const dynamic = "force-dynamic"

const AiExtractionSchema = z.object({
  distanceKm: z.number().positive(),
  durationSeconds: z.number().positive(),
  paceSecondsPerKm: z.number().positive().optional(),
  calories: z.number().positive().optional(),
  notes: z.string().optional(),
  completedAt: z.string().optional(),
  type: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey || openaiKey === "your_openai_api_key_here") {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 503 },
      )
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 })
    }

    if (file.size > 6 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large. Please upload a file under 6MB." }, { status: 413 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const imagePart = {
      type: "image" as const,
      image: new Uint8Array(arrayBuffer),
      mimeType: file.type || "image/jpeg",
    }

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      temperature: 0.2,
      schema: AiExtractionSchema,
      messages: [
        {
          role: "system",
          content:
            "You are an expert running coach. Extract structured run details from workout screenshots.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this workout screenshot and return run data. Use kilometers for distance and seconds for durations. If pace is visible, return seconds per kilometer. Include calories and notes if shown.",
            },
            imagePart,
          ],
        },
      ],
    })

    const parsed = AiExtractionSchema.safeParse(object)
    if (!parsed.success) {
      return NextResponse.json({ error: "Unable to parse activity data" }, { status: 422 })
    }

    return NextResponse.json({ data: parsed.data })
  } catch (error) {
    console.error("AI activity extraction failed", error)
    return NextResponse.json({ error: "Failed to analyze activity image" }, { status: 500 })
  }
}
