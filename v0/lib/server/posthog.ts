import "server-only"

import { logger } from "@/lib/logger"
import {
  resolvePosthogHost,
  resolveServerPosthogKey,
  warnMissingPosthogKey,
} from "@/lib/posthog-config"

function getPosthogConfig(): { apiKey: string; host: string } | null {
  const apiKey = resolveServerPosthogKey()
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      warnMissingPosthogKey("server")
    }
    return null
  }

  return {
    apiKey,
    host: resolvePosthogHost({ preferServerHost: true }),
  }
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
