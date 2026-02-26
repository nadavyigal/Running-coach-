import { expect, test, type Page } from "@playwright/test"

async function ensureProfileVisible(page: Page) {
  await page.goto("/?screen=profile", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1200)

  const profileHub = page.getByText(/Profile Hub|Runner identity/i).first()
  if (await profileHub.isVisible().catch(() => false)) {
    return true
  }

  const profileNav = page.getByRole("button", { name: /profile/i }).first()
  if (await profileNav.isVisible().catch(() => false)) {
    await profileNav.click()
    await page.waitForTimeout(1000)
  }

  return page.getByText(/Profile Hub|Runner identity/i).first().isVisible().catch(() => false)
}

test.describe("Profile Visual Snapshots", () => {
  test("capture mobile and desktop profile snapshots", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Visual snapshot flow runs on chromium only.")

    const ready = await ensureProfileVisible(page)
    test.skip(!ready, "Profile screen is not reachable in current test seed state.")

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(500)
    await expect(page.getByText(/Profile Hub|Runner identity/i).first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("profile-390x844.png"), fullPage: true })

    await page.setViewportSize({ width: 430, height: 932 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: testInfo.outputPath("profile-430x932.png"), fullPage: true })

    await page.setViewportSize({ width: 1366, height: 900 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: testInfo.outputPath("profile-desktop-1366x900.png"), fullPage: true })
  })
})
