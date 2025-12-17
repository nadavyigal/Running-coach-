import { expect, test } from '@playwright/test'

test.describe('PWA / Offline', () => {
  test('registers a service worker and serves cached content offline', async ({ context, page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(() => 'serviceWorker' in navigator)

    const hasActiveServiceWorker = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return Boolean(registration?.active)
    })
    expect(hasActiveServiceWorker).toBe(true)

    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(manifestHref).toBeTruthy()

    const manifestUrl = manifestHref?.startsWith('http')
      ? manifestHref
      : new URL(manifestHref || '/manifest.webmanifest', page.url()).toString()
    const manifestResponse = await page.request.get(manifestUrl)
    expect(manifestResponse.ok()).toBe(true)

    const manifest = (await manifestResponse.json()) as { name?: string; short_name?: string; icons?: unknown[] }
    expect(manifest.name || manifest.short_name).toBeTruthy()
    expect(Array.isArray(manifest.icons)).toBe(true)

    const offlineHtmlCached = await page.evaluate(async () => {
      const response = await caches.match('/offline.html')
      return Boolean(response)
    })
    expect(offlineHtmlCached).toBe(true)

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect.poll(async () => {
      const offlineVisible = await page.getByRole('heading', { name: /you are offline/i }).isVisible().catch(() => false)
      const onboardingVisible = await page.getByRole('button', { name: /get started/i }).isVisible().catch(() => false)
      return offlineVisible || onboardingVisible
    }).toBe(true)

    await context.setOffline(false)
  })
})
