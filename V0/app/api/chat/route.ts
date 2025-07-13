import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: openai("gpt-4o"),
    system: `You are an expert AI running coach. You provide helpful, encouraging, and scientifically-backed advice about running training, technique, nutrition, injury prevention, and motivation. Keep responses concise but informative. Always be supportive and positive. Focus on practical, actionable advice.`,
    messages,
  })

  return result.toDataStreamResponse()
}
