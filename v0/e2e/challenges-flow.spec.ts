import { expect, test } from '@playwright/test'

test('browse challenges, join one, and view progress', async ({ page }) => {
  let joined = false
  let completedToday = false

  await page.route('**/api/challenges?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challenges: [
          {
            id: 'challenge-1',
            slug: 'start-running',
            title: '21-Day Start Running',
            description: 'Build consistency in 21 days.',
            durationDays: 21,
            joined,
          },
        ],
      }),
    })
  })

  await page.route('**/api/challenges', async (route) => {
    joined = true
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        joined: true,
        challenge: {
          id: 'challenge-1',
          slug: 'start-running',
          title: '21-Day Start Running',
          durationDays: 21,
        },
      }),
    })
  })

  await page.route('**/api/challenges/challenge-1/progress?**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('selfReport') === 'true') {
      completedToday = true
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'challenge-1',
        challengeTitle: '21-Day Start Running',
        startedAt: '2026-02-24',
        durationDays: 21,
        currentDay: 1,
        completedDays: completedToday ? 1 : 0,
        progressPercent: completedToday ? 5 : 0,
        daysRemaining: completedToday ? 20 : 21,
        completedToday,
        completionBadgeEarned: false,
        canSelfReport: !completedToday,
        streak: {
          current: completedToday ? 1 : 0,
          best: completedToday ? 1 : 0,
          lastActiveDay: completedToday ? '2026-02-24' : null,
        },
      }),
    })
  })

  await page.goto('/challenges')

  await expect(page.getByTestId('challenges-page')).toBeVisible()
  await expect(page.getByTestId('challenge-card-start-running')).toBeVisible()

  await page.getByTestId('challenge-join-start-running').click()
  await expect(page.getByTestId('challenge-progress')).toBeVisible()

  await page.getByTestId('challenge-self-report').click()
  await expect(page.getByText('Completed today')).toBeVisible()
})
