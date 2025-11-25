import { test, expect } from '@playwright/test'

test.describe('Onboarding to Today - Atomic and Gated', () => {
  test('completes onboarding and lands on Today with plan loaded', async ({ page }) => {
    await page.goto('/')

    // Step 1 -> 2
    await page.getByRole('button', { name: /get started/i }).click()

    // Goal
    await page.getByText(/Build a Running Habit/i).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Experience
    await page.getByText(/Beginner/i).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Optional RPE step
    await page.getByRole('button', { name: /continue/i }).click()

    // Age
    await page.getByLabel(/your age/i).fill('25')
    await page.getByRole('button', { name: /continue/i }).click()

    // Schedule
    await page.getByText(/Morning/i).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Consents
    await page.getByLabel(/processing of my health data/i).click()
    await page.getByLabel(/Privacy Policy/i).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Privacy
    await page.getByRole('button', { name: /continue/i }).click()

    // Finish (atomic)
    await page.getByRole('button', { name: /Start My Journey/i }).click()

    // Wait for navigation gate to pass. We should not see partial dashboard.
    // Expect elements typical to Today or Plan.
    await expect(page.getByText(/Training Plan/i)).toBeVisible({ timeout: 10000 })
  })
})

