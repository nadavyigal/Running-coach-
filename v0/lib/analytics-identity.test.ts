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

describe('whenPosthogReady', () => {
  it('waits for PostHog to load, then runs the callback once', async () => {
    vi.useFakeTimers()
    const { whenPosthogReady, onPosthogLoaded } = await loadIdentity()
    const callback = vi.fn()

    whenPosthogReady(callback)
    expect(callback).not.toHaveBeenCalled()

    onPosthogLoaded(fakePosthog())
    expect(callback).toHaveBeenCalledTimes(1)

    vi.runAllTimers()
    expect(callback).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('runs immediately once PostHog has loaded', async () => {
    const { whenPosthogReady, onPosthogLoaded } = await loadIdentity()
    onPosthogLoaded(fakePosthog())
    const callback = vi.fn()

    whenPosthogReady(callback)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('falls back after the timeout when PostHog never loads', async () => {
    vi.useFakeTimers()
    const { whenPosthogReady, onPosthogLoaded } = await loadIdentity()
    const callback = vi.fn()

    whenPosthogReady(callback, 5000)
    vi.advanceTimersByTime(4999)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    // A late load must not run it again: the timeout removed it from the queue.
    onPosthogLoaded(fakePosthog())
    expect(callback).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
