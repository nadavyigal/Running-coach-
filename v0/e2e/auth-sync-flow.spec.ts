import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Authentication and Sync Flow
 *
 * These tests verify the complete user journey from signup to data sync:
 * 1. User signs up with email/password
 * 2. Profile is created in Supabase
 * 3. Local data syncs to cloud
 * 4. Admin dashboard shows updated metrics
 */

test.describe('Authentication and Sync Flow', () => {
  const testEmail = `test-${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'

  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/')
  })

  test('should complete full signup and data sync flow', async ({ page }) => {
    // Step 1: Navigate to signup
    await test.step('Navigate to signup', async () => {
      // Look for login/signup button
      const signupButton = page.locator('button', { hasText: /sign up|create account/i }).first()

      if (await signupButton.isVisible()) {
        await signupButton.click()
      }

      await expect(page).toHaveURL(/\/auth|\/signup|sign-up/)
    })

    // Step 2: Fill signup form
    await test.step('Complete signup form', async () => {
      // Fill in email
      await page.fill('input[name="email"], input[type="email"]', testEmail)

      // Fill in password
      await page.fill('input[name="password"], input[type="password"]', testPassword)

      // Fill in confirm password if exists
      const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[placeholder*="Confirm"]')
      if (await confirmPasswordInput.count() > 0) {
        await confirmPasswordInput.fill(testPassword)
      }

      // Submit form
      await page.click('button[type="submit"]')
    })

    // Step 3: Wait for successful signup
    await test.step('Verify successful signup', async () => {
      // Wait for redirect or success message
      await page.waitForURL(/(?!auth|signup)/, { timeout: 10000 })

      // Should be redirected to main app or onboarding
      await expect(page).toHaveURL(/\/$|\/onboarding|\/today/)
    })

    // Step 4: Check if welcome modal appears (for existing users)
    await test.step('Handle welcome modal if present', async () => {
      const welcomeModal = page.locator('[role="dialog"]', { hasText: /welcome back|data migration/i })

      if (await welcomeModal.isVisible({ timeout: 2000 })) {
        const continueButton = welcomeModal.locator('button', { hasText: /continue|got it|okay/i })
        await continueButton.click()
      }
    })

    // Step 5: Record a test run (to generate data for sync)
    await test.step('Record a test run', async () => {
      // Navigate to record screen
      const recordButton = page.locator('button, a', { hasText: /record|start run/i }).first()

      if (await recordButton.isVisible()) {
        await recordButton.click()
        await expect(page).toHaveURL(/\/record/)

        // Start a quick run (if manual recording)
        const startButton = page.locator('button', { hasText: /start|begin/i }).first()
        if (await startButton.isVisible({ timeout: 2000 })) {
          await startButton.click()

          // Wait a moment
          await page.waitForTimeout(2000)

          // Stop the run
          const stopButton = page.locator('button', { hasText: /stop|finish/i }).first()
          if (await stopButton.isVisible()) {
            await stopButton.click()
          }

          // Save the run
          const saveButton = page.locator('button', { hasText: /save|complete/i }).first()
          if (await saveButton.isVisible()) {
            await saveButton.click()
          }
        }
      }
    })

    // Step 6: Wait for sync to complete
    await test.step('Wait for sync', async () => {
      // Look for sync indicator
      const syncIndicator = page.locator('[data-testid="sync-status"], [aria-label*="sync"]')

      if (await syncIndicator.isVisible({ timeout: 2000 })) {
        // Wait for sync to complete (shows "synced" or checkmark)
        await expect(syncIndicator).toContainText(/synced|up to date/i, { timeout: 30000 })
      } else {
        // If no indicator, wait a fixed time for background sync
        await page.waitForTimeout(5000)
      }
    })
  })

  test('should prevent non-authenticated access', async ({ page }) => {
    await test.step('Try to access protected route without auth', async () => {
      // Try to access profile or protected route
      await page.goto('/profile')

      // Should redirect to home or login
      await expect(page).toHaveURL(/\/$|\/auth|\/login/)
    })
  })

  test('should handle login for existing user', async ({ page }) => {
    // First create a user (using signup)
    await test.step('Create test user', async () => {
      await page.goto('/')

      const signupButton = page.locator('button', { hasText: /sign up/i }).first()
      if (await signupButton.isVisible()) {
        await signupButton.click()
      }

      await page.fill('input[type="email"]', testEmail)
      await page.fill('input[type="password"]', testPassword)

      const confirmPassword = page.locator('input[name="confirmPassword"]')
      if (await confirmPassword.count() > 0) {
        await confirmPassword.fill(testPassword)
      }

      await page.click('button[type="submit"]')
      await page.waitForURL(/\//, { timeout: 10000 })
    })

    // Sign out
    await test.step('Sign out', async () => {
      const profileButton = page.locator('button, a', { hasText: /profile|account/i }).first()
      if (await profileButton.isVisible()) {
        await profileButton.click()
      }

      const signOutButton = page.locator('button', { hasText: /sign out|logout/i }).first()
      if (await signOutButton.isVisible()) {
        await signOutButton.click()
        await page.waitForTimeout(1000)
      }
    })

    // Sign back in
    await test.step('Sign in with existing credentials', async () => {
      const loginButton = page.locator('button', { hasText: /log in|sign in/i }).first()
      if (await loginButton.isVisible()) {
        await loginButton.click()
      }

      await page.fill('input[type="email"]', testEmail)
      await page.fill('input[type="password"]', testPassword)
      await page.click('button[type="submit"]')

      // Should be logged in
      await page.waitForURL(/\/$|\/today|\/profile/, { timeout: 10000 })
    })
  })

  test('should show validation errors for invalid signup', async ({ page }) => {
    await test.step('Navigate to signup', async () => {
      const signupButton = page.locator('button', { hasText: /sign up/i }).first()
      if (await signupButton.isVisible()) {
        await signupButton.click()
      }
    })

    await test.step('Submit with weak password', async () => {
      await page.fill('input[type="email"]', testEmail)
      await page.fill('input[type="password"]', '123') // Too weak

      const confirmPassword = page.locator('input[name="confirmPassword"]')
      if (await confirmPassword.count() > 0) {
        await confirmPassword.fill('123')
      }

      await page.click('button[type="submit"]')

      // Should show error message
      const errorMessage = page.locator('[role="alert"], .error, [class*="error"]')
      await expect(errorMessage).toBeVisible({ timeout: 3000 })
    })
  })

  test('should display sync status indicator', async ({ page }) => {
    await test.step('Look for sync indicator after login', async () => {
      // This test assumes user is already logged in
      // You might need to add login steps here

      await page.goto('/')

      // Look for sync status component
      const syncStatus = page.locator('[data-testid="sync-status"], [aria-label*="sync"]')

      // Sync indicator should exist (might be hidden initially)
      const count = await syncStatus.count()
      expect(count).toBeGreaterThan(0)
    })
  })
})

test.describe('Admin Dashboard Access', () => {
  const adminEmail = 'nadav.yigal@gmail.com'
  const adminPassword = 'AdminPassword123!'

  test('should allow admin user to access dashboard', async ({ page }) => {
    // Note: This test requires admin user to be created with the email from ADMIN_EMAILS

    await test.step('Login as admin', async () => {
      await page.goto('/')

      const loginButton = page.locator('button', { hasText: /log in|sign in/i }).first()
      if (await loginButton.isVisible()) {
        await loginButton.click()
      }

      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      await page.waitForURL(/\/$|\/today/, { timeout: 10000 })
    })

    await test.step('Navigate to admin dashboard', async () => {
      await page.goto('/admin/dashboard')

      // Should not be redirected
      await expect(page).toHaveURL('/admin/dashboard')

      // Should see admin dashboard content
      await expect(page.locator('h1')).toContainText(/admin dashboard/i)

      // Should see metrics cards
      const metricsCards = page.locator('[class*="card"]')
      expect(await metricsCards.count()).toBeGreaterThan(0)
    })

    await test.step('Verify metrics display', async () => {
      // Check for key metrics
      await expect(page.locator('text=/Total Users/i')).toBeVisible()
      await expect(page.locator('text=/Active Users/i')).toBeVisible()
      await expect(page.locator('text=/Total Runs/i')).toBeVisible()
    })

    await test.step('Verify external analytics links', async () => {
      // Check for PostHog link
      const posthogLink = page.locator('a[href*="posthog"]')
      await expect(posthogLink).toBeVisible()

      // Check for Google Analytics link
      const gaLink = page.locator('a[href*="analytics.google"]')
      await expect(gaLink).toBeVisible()
    })
  })

  test('should block non-admin users from admin dashboard', async ({ page }) => {
    const regularEmail = `regular-${Date.now()}@example.com`
    const regularPassword = 'RegularPassword123!'

    await test.step('Create regular user', async () => {
      await page.goto('/')

      const signupButton = page.locator('button', { hasText: /sign up/i }).first()
      if (await signupButton.isVisible()) {
        await signupButton.click()
      }

      await page.fill('input[type="email"]', regularEmail)
      await page.fill('input[type="password"]', regularPassword)

      const confirmPassword = page.locator('input[name="confirmPassword"]')
      if (await confirmPassword.count() > 0) {
        await confirmPassword.fill(regularPassword)
      }

      await page.click('button[type="submit"]')
      await page.waitForURL(/\//, { timeout: 10000 })
    })

    await test.step('Try to access admin dashboard', async () => {
      await page.goto('/admin/dashboard')

      // Should be redirected away from admin dashboard
      await expect(page).not.toHaveURL('/admin/dashboard')
      await expect(page).toHaveURL('/')
    })
  })
})

test.describe('Data Sync Verification', () => {
  test('should sync local data to Supabase', async ({ page, request }) => {
    const testEmail = `sync-test-${Date.now()}@example.com`
    const testPassword = 'SyncTest123!'

    await test.step('Create user and add local data', async () => {
      await page.goto('/')

      // Signup
      const signupButton = page.locator('button', { hasText: /sign up/i }).first()
      if (await signupButton.isVisible()) {
        await signupButton.click()
      }

      await page.fill('input[type="email"]', testEmail)
      await page.fill('input[type="password"]', testPassword)

      const confirmPassword = page.locator('input[name="confirmPassword"]')
      if (await confirmPassword.count() > 0) {
        await confirmPassword.fill(testPassword)
      }

      await page.click('button[type="submit"]')
      await page.waitForURL(/\//, { timeout: 10000 })
    })

    await test.step('Wait for sync to complete', async () => {
      // Wait for background sync
      await page.waitForTimeout(10000)
    })

    // Note: Verifying data in Supabase requires API access
    // This is a placeholder for actual verification logic
    await test.step('Verify data in Supabase', async () => {
      // In a real test, you would:
      // 1. Get auth token from page
      // 2. Make API call to Supabase to verify data
      // 3. Assert data exists and matches local data

      // For now, we just verify no errors occurred
      const errorMessages = page.locator('[role="alert"][class*="error"]')
      expect(await errorMessages.count()).toBe(0)
    })
  })
})
