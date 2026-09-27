import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadIdentity() {
  vi.resetModules()
  return import('./analytics-identity')
}

function fakePosthog() {
  return { identify: vi.fn(), reset: vi.fn() }
}

describe('analytics-identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('holds an identify made before PostHog has loaded and applies it on load', async () => {
    const { identifyUser, onPosthogLoaded } = await loadIdentity()
    const posthog = fakePosthog()

    identifyUser('user-uuid-1')
    expect(posthog.identify).not.toHaveBeenCalled()

    onPosthogLoaded(posthog)

    expect(posthog.identify).toHaveBeenCalledTimes(1)
    expect(posthog.identify).toHaveBeenCalledWith('user-uuid-1')
  })

  it('identifies immediately once PostHog has loaded', async () => {
    const { identifyUser, onPosthogLoaded } = await loadIdentity()
    const posthog = fakePosthog()
    onPosthogLoaded(posthog)

    identifyUser('user-uuid-2')

    expect(posthog.identify).toHaveBeenCalledWith('user-uuid-2')
  })

  it('keeps only the latest pending identity', async () => {
    const { identifyUser, onPosthogLoaded } = await loadIdentity()
    const posthog = fakePosthog()

    identifyUser('first')
    identifyUser('second')
    onPosthogLoaded(posthog)

    expect(posthog.identify).toHaveBeenCalledTimes(1)
    expect(posthog.identify).toHaveBeenCalledWith('second')
  })

  it('resets PostHog on sign-out so the next user on this device is not merged', async () => {
    const { identifyUser, resetIdentity, onPosthogLoaded } = await loadIdentity()
    const posthog = fakePosthog()
    onPosthogLoaded(posthog)
    identifyUser('user-uuid-3')

    resetIdentity()

    expect(posthog.reset).toHaveBeenCalledTimes(1)
  })

  it('drops a pending identity when sign-out happens before PostHog loads', async () => {
    const { identifyUser, resetIdentity, onPosthogLoaded } = await loadIdentity()
    const posthog = fakePosthog()

    identifyUser('user-uuid-4')
    resetIdentity()
    onPosthogLoaded(posthog)

    expect(posthog.identify).not.toHaveBeenCalled()
    expect(posthog.reset).toHaveBeenCalledTimes(1)
  })
})
