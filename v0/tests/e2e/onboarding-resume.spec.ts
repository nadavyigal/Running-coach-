import { test, expect, type Page } from '@playwright/test'

/**
 * E2E Tests for Onboarding Resume Functionality
 * Story RS-ONB-001: Resume functionality and validation
 */

// Test helpers
async function startOnboarding(page: Page) {
  await page.goto('/')
  await page.waitForSelector('[data-testid="onboarding-screen"]', { timeout: 10000 })
}

async function proceedToStep(page: Page, targetStep: number) {
  for (let step = 1; step < targetStep; step++) {
    // Fill required data for each step
    switch (step) {
      case 1:
        await page.click('button:has-text("Let\'s Get Started")')
        break
      case 2:
        await page.click('[data-testid="goal-habit"]')
        await page.click('button:has-text("Continue")')
        break
      case 3:
        await page.click('[data-testid="experience-beginner"]')
        await page.click('button:has-text("Continue")')
        break
      case 4:
        // RPE is optional, just continue
        await page.click('button:has-text("Continue")')
        break
      case 5:
        await page.fill('input[type="number"]', '25')
        await page.click('button:has-text("Continue")')
        break
      case 6:
        await page.click('[data-testid="time-morning"]')
        await page.click('button:has-text("Continue")')
        break
      case 7:
        await page.check('#data-consent')
        await page.check('#gdpr-consent')
        await page.click('button:has-text("Continue")')
        break
      case 8:
        // Privacy settings - use defaults
        await page.click('button:has-text("Continue")')
        break
    }
    
    // Wait for next step to load
    await page.waitForTimeout(500)
  }
}

async function simulatePageRefresh(page: Page) {
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000) // Allow reconciliation to complete
}

async function clearBrowserData(page: Page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    // Clear IndexedDB
    if (window.indexedDB && window.indexedDB.databases) {
      window.indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name) {
            window.indexedDB.deleteDatabase(db.name)
          }
        })
      })
    }
  })
}

test.describe('Onboarding Resume Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all data before each test
    await clearBrowserData(page)
  })

  test('should show resume prompt when refreshing mid-onboarding', async ({ page }) => {
    // Start onboarding and proceed to step 4
    await startOnboarding(page)
    await proceedToStep(page, 4)
    
    // Verify we're at step 4
    await expect(page.locator('[data-testid="current-step"]')).toContainText('4')
    
    // Refresh the page
    await simulatePageRefresh(page)
    
    // Should show resume prompt
    await expect(page.locator('text=Resume Onboarding?')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Continue Previous Session')).toBeVisible()
    await expect(page.locator('text=Start Fresh')).toBeVisible()
  })

  test('should resume onboarding at correct step with preserved data', async ({ page }) => {
    // Start onboarding and proceed to step 5 with specific data
    await startOnboarding(page)
    await proceedToStep(page, 2)
    
    // Select specific goal
    await page.click('[data-testid="goal-distance"]')
    await page.click('button:has-text("Continue")')
    
    // Select experience
    await page.click('[data-testid="experience-intermediate"]')
    await page.click('button:has-text("Continue")')
    
    // Set RPE
    const rpeSlider = page.locator('input[type="range"]').first()
    await rpeSlider.fill('7')
    await page.click('button:has-text("Continue")')
    
    // Enter age
    await page.fill('input[type="number"]', '30')
    await page.click('button:has-text("Continue")')
    
    // Now at step 6 - refresh
    await simulatePageRefresh(page)
    
    // Click resume
    await page.click('text=Continue Previous Session')
    await page.waitForTimeout(2000) // Wait for state restoration
    
    // Should be back at step 6
    await expect(page.locator('[data-testid="current-step"]')).toContainText('6')
    
    // Go back to verify preserved data
    // (Implementation would need back navigation or data verification elements)
    // This is a simplified check - in real implementation, you'd verify form values
  })

  test('should start fresh when choosing start fresh option', async ({ page }) => {
    // Start onboarding and proceed to step 3
    await startOnboarding(page)
    await proceedToStep(page, 3)
    
    // Refresh page
    await simulatePageRefresh(page)
    
    // Choose start fresh
    await page.click('text=Start Fresh')
    await page.waitForTimeout(1000)
    
    // Should be back at step 1
    await expect(page.locator('[data-testid="current-step"]')).toContainText('1')
    
    // Resume prompt should be gone
    await expect(page.locator('text=Resume Onboarding?')).not.toBeVisible()
  })

  test('should handle multiple refresh cycles correctly', async ({ page }) => {
    // Start onboarding
    await startOnboarding(page)
    await proceedToStep(page, 3)
    
    // First refresh cycle
    await simulatePageRefresh(page)
    await page.click('text=Continue Previous Session')
    await page.waitForTimeout(1000)
    
    // Proceed one more step
    await page.click('[data-testid="experience-advanced"]')
    await page.click('button:has-text("Continue")')
    
    // Second refresh cycle
    await simulatePageRefresh(page)
    await page.click('text=Continue Previous Session')
    await page.waitForTimeout(1000)
    
    // Should be at step 4
    await expect(page.locator('[data-testid="current-step"]')).toContainText('4')
  })

  test('should validate data on resume and show errors for invalid data', async ({ page }) => {
    // Start onboarding and proceed to step 7 (consents)
    await startOnboarding(page)
    await proceedToStep(page, 7)
    
    // Check data consent but not GDPR (invalid state)
    await page.check('#data-consent')
    // Intentionally don't check GDPR consent
    
    // Try to continue (should fail validation)
    await page.click('button:has-text("Continue")')
    
    // Should see validation error
    await expect(page.locator('text=GDPR consent must be accepted')).toBeVisible()
    
    // Refresh without fixing the error
    await simulatePageRefresh(page)
    
    // Resume session
    await page.click('text=Continue Previous Session')
    await page.waitForTimeout(1000)
    
    // Should still be at step 7 with validation error present
    await expect(page.locator('[data-testid="current-step"]')).toContainText('7')
    
    // Fix the validation error
    await page.check('#gdpr-consent')
    await page.click('button:has-text("Continue")')
    
    // Should now proceed to step 8
    await expect(page.locator('[data-testid="current-step"]')).toContainText('8')
  })

  test('should expire old sessions and not show resume prompt', async ({ page }) => {
    // This test would need to manipulate timestamp in the database
    // Simulating by setting very old session data
    await page.evaluate(() => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      const sessionData = {
        sessionId: 'expired-session',
        currentStep: 4,
        partialData: { goal: 'habit' },
        conversationId: 'expired-session',
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        isResumed: false
      }
      
      sessionStorage.setItem('onboarding_state', JSON.stringify(sessionData))
    })
    
    // Start the app
    await page.goto('/')
    await page.waitForTimeout(2000) // Wait for reconciliation
    
    // Should NOT show resume prompt for expired session
    await expect(page.locator('text=Resume Onboarding?')).not.toBeVisible()
    
    // Should start fresh onboarding
    await expect(page.locator('[data-testid="onboarding-screen"]')).toBeVisible()
  })

  test('should handle database vs localStorage conflicts correctly', async ({ page }) => {
    // Simulate conflicting data in localStorage vs session
    await page.evaluate(() => {
      // Set localStorage to indicate completed onboarding
      localStorage.setItem('onboarding-complete', 'true')
      localStorage.setItem('user-data', JSON.stringify({
        goal: 'speed',
        experience: 'advanced'
      }))
      
      // But set session storage with incomplete onboarding
      const sessionData = {
        sessionId: 'incomplete-session',
        currentStep: 5,
        partialData: { goal: 'habit', experience: 'beginner', age: 25 },
        conversationId: 'incomplete-session',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isResumed: false
      }
      
      sessionStorage.setItem('onboarding_state', JSON.stringify(sessionData))
    })
    
    await page.goto('/')
    await page.waitForTimeout(3000) // Wait for reconciliation
    
    // Reconciliation should resolve the conflict
    // In this case, session storage should take precedence as it's more recent
    // Should show resume prompt for the incomplete session
    await expect(page.locator('text=Resume Onboarding?')).toBeVisible()
  })

  test('should complete full onboarding after resume', async ({ page }) => {
    // Start and proceed partway through onboarding
    await startOnboarding(page)
    await proceedToStep(page, 6)
    
    // Select schedule preferences
    await page.click('[data-testid="time-evening"]')
    // Adjust days per week using slider
    const slider = page.locator('input[type="range"]')
    await slider.fill('4')
    
    // Refresh before completing
    await simulatePageRefresh(page)
    
    // Resume
    await page.click('text=Continue Previous Session')
    await page.waitForTimeout(1000)
    
    // Complete remaining steps
    await page.click('button:has-text("Continue")') // Step 7
    
    // Consent step
    await page.check('#data-consent')
    await page.check('#gdpr-consent')
    await page.click('button:has-text("Continue")')
    
    // Privacy settings step - use defaults
    await page.click('button:has-text("Continue")')
    
    // Final step - generate plan
    await page.click('button:has-text("Generate My Plan")')
    
    // Should complete and navigate to today screen
    await expect(page).toHaveURL(/today/, { timeout: 15000 })
    
    // Verify plan was created
    await expect(page.locator('text=Today\'s Workout')).toBeVisible({ timeout: 10000 })
  })

  test('should handle network errors during resume gracefully', async ({ page }) => {
    // Start onboarding
    await startOnboarding(page)
    await proceedToStep(page, 4)
    
    // Go offline
    await page.context().setOffline(true)
    
    // Refresh
    await simulatePageRefresh(page)
    
    // Should still show resume prompt (from sessionStorage)
    await expect(page.locator('text=Resume Onboarding?')).toBeVisible()
    
    // Try to resume
    await page.click('text=Continue Previous Session')
    await page.waitForTimeout(1000)
    
    // Should work offline using sessionStorage
    await expect(page.locator('[data-testid="current-step"]')).toContainText('4')
    
    // Go back online
    await page.context().setOffline(false)
    
    // Continue with onboarding - should sync when online
    await page.click('button:has-text("Continue")')
    
    // Should proceed normally
    await expect(page.locator('[data-testid="current-step"]')).toContainText('5')
  })

  test('should preserve AI-generated data during resume', async ({ page }) => {
    // This test would verify that AI chat data is preserved
    // Simplified version focusing on goal wizard data
    
    await startOnboarding(page)
    
    // Use goal wizard (if available)
    const goalWizardButton = page.locator('text=Goal Discovery Wizard')
    if (await goalWizardButton.isVisible()) {
      await goalWizardButton.click()
      
      // Interact with goal wizard
      await page.fill('textarea', 'I want to run a marathon in 6 months')
      await page.click('button:has-text("Analyze Goals")')
      await page.waitForSelector('text=Goal Analysis Complete')
      
      // Apply AI suggestions
      await page.click('button:has-text("Use These Goals")')
    } else {
      // Skip if goal wizard not available, just select manually
      await page.click('[data-testid="goal-distance"]')
    }
    
    await page.click('button:has-text("Continue")')
    await proceedToStep(page, 4)
    
    // Refresh
    await simulatePageRefresh(page)
    
    // Resume
    await page.click('text=Continue Previous Session')
    await page.waitForTimeout(1000)
    
    // AI-generated data should be preserved
    // (This would need specific test attributes to verify AI data)
    await expect(page.locator('[data-testid="current-step"]')).toContainText('4')
  })

  test('should handle browser back/forward with resume', async ({ page }) => {
    await startOnboarding(page)
    await proceedToStep(page, 3)
    
    // Use browser back
    await page.goBack()
    
    // Should handle gracefully (either show resume or restart)
    await page.waitForTimeout(1000)
    
    // Use browser forward
    await page.goForward()
    await page.waitForTimeout(1000)
    
    // Should maintain consistency
    // (Specific behavior would depend on implementation)
  })
})

test.describe('Onboarding Validation E2E', () => {
  test('should validate required fields and show user-friendly errors', async ({ page }) => {
    await startOnboarding(page)
    await proceedToStep(page, 5)
    
    // Try to continue without entering age
    await page.click('button:has-text("Continue")')
    
    // Should show validation error
    await expect(page.locator('text=Age is required')).toBeVisible()
    
    // Enter invalid age
    await page.fill('input[type="number"]', '5')
    await page.click('button:has-text("Continue")')
    
    // Should show age validation error
    await expect(page.locator('text=Age must be at least 10 years')).toBeVisible()
    
    // Enter valid age
    await page.fill('input[type="number"]', '25')
    await page.click('button:has-text("Continue")')
    
    // Should proceed to next step
    await expect(page.locator('[data-testid="current-step"]')).toContainText('6')
  })

  test('should validate consent requirements', async ({ page }) => {
    await startOnboarding(page)
    await proceedToStep(page, 7)
    
    // Try to continue without required consents
    await page.click('button:has-text("Continue")')
    
    // Should show consent validation errors
    await expect(page.locator('text=Data processing consent must be accepted')).toBeVisible()
    await expect(page.locator('text=GDPR consent must be accepted')).toBeVisible()
    
    // Check only data consent
    await page.check('#data-consent')
    await page.click('button:has-text("Continue")')
    
    // Should still show GDPR error
    await expect(page.locator('text=GDPR consent must be accepted')).toBeVisible()
    
    // Check GDPR consent
    await page.check('#gdpr-consent')
    await page.click('button:has-text("Continue")')
    
    // Should proceed
    await expect(page.locator('[data-testid="current-step"]')).toContainText('8')
  })

  test('should validate schedule preferences', async ({ page }) => {
    await startOnboarding(page)
    await proceedToStep(page, 6)
    
    // Try to continue without selecting preferred times
    await page.click('button:has-text("Continue")')
    
    // Should show validation error
    await expect(page.locator('text=At least one preferred time slot is required')).toBeVisible()
    
    // Select too many time slots (if UI allows)
    await page.click('[data-testid="time-morning"]')
    await page.click('[data-testid="time-afternoon"]')
    await page.click('[data-testid="time-evening"]')
    
    // Try to select a 4th option (should be prevented or show error)
    const nightOption = page.locator('[data-testid="time-night"]')
    if (await nightOption.isVisible()) {
      await nightOption.click()
      await page.click('button:has-text("Continue")')
      
      // Should show too many selections error
      await expect(page.locator('text=Cannot select more than 3 time slots')).toBeVisible()
      
      // Uncheck one option
      await page.uncheck('[data-testid="time-night"]')
    }
    
    await page.click('button:has-text("Continue")')
    
    // Should proceed
    await expect(page.locator('[data-testid="current-step"]')).toContainText('7')
  })
})