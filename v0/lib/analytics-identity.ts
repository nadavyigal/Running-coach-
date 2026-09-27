/**
 * PostHog identity that is safe to set before PostHog has loaded.
 *
 * `lib/posthog-provider.tsx` loads PostHog lazily (idle callback + dynamic
 * import) and PostHog drops `identify()` calls made before `init` finishes.
 * `lib/auth-context.tsx` restores the session at mount, usually earlier, so the
 * identity is held here and applied from PostHog's `loaded` callback.
 *
 * No imports on purpose: the provider and auth context load this on every page.
 */

type IdentityClient = {
  identify?: (distinctId: string) => void
  reset?: () => void
}

let client: IdentityClient | null = null
let pendingUserId: string | null = null
let pendingReset = false

export function identifyUser(userId: string | number): void {
  const distinctId = String(userId)
  if (client?.identify) {
    client.identify(distinctId)
    pendingUserId = null
    return
  }
  pendingUserId = distinctId
}

export function resetIdentity(): void {
  pendingUserId = null
  if (client?.reset) {
    client.reset()
    return
  }
  pendingReset = true
}

export function onPosthogLoaded(loaded: IdentityClient): void {
  client = loaded
  if (pendingReset) {
    pendingReset = false
    loaded.reset?.()
  }
  if (pendingUserId) {
    loaded.identify?.(pendingUserId)
    pendingUserId = null
  }
}
