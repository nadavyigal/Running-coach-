import "server-only"

import { logger } from "@/lib/logger"

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com"

function getPosthogConfig(): { apiKey: string; host: string } | null {
  const apiKey =
    process.env.POSTHOG_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY?.trim() ||
    ""

  if (!apiKey) return null

  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/$/, "")
  return { apiKey, host }
}

export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  logger.info(event, properties)

  const config = getPosthogConfig()
  if (!config) return

  const distinctIdRaw = properties.userId ?? properties.user_id ?? properties.distinct_id ?? "system"
  const distinctId = String(distinctIdRaw)

  try {
    await fetch(`${config.host}/capture/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: config.apiKey,
        event,
        properties: {
          distinct_id: distinctId,
          ...properties,
        },
      }),
    })
  } catch (error) {
    logger.warn("PostHog capture failed:", error)
  }
}
