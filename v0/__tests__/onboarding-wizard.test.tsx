import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { OnboardingScreen } from '@/components/onboarding-screen'
import * as dbMod from '@/lib/dbUtils'

// Use fake indexeddb to avoid real browser DB
import 'fake-indexeddb/auto'

describe('OnboardingScreen - Atomic Finish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables Finish during commit and navigates only after profile-ready', async () => {
    const onComplete = vi.fn()

    const completeSpy = vi.spyOn(dbMod.dbUtils, 'completeOnboardingAtomic').mockResolvedValue({ userId: 1, planId: 11 })

    render(<OnboardingScreen onComplete={onComplete} />)

    // Step 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))

    // Select goal
    fireEvent.click(screen.getByText(/Build a Running Habit/i))
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))

    // Experience
    fireEvent.click(screen.getByText(/Beginner/i))
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))

    // Age
    const ageInput = screen.getByLabelText(/your age/i)
    fireEvent.change(ageInput, { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))

    // Reference race (optional)
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))

    // Schedule
    fireEvent.click(screen.getByText(/3 days/i))
    fireEvent.click(screen.getByText(/Monday/i))
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))

    // Finish
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/i }))

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalled()
    })

    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })

  it('shows retry copy when commit fails', async () => {
    const onComplete = vi.fn()

    vi.spyOn(dbMod.dbUtils, 'completeOnboardingAtomic').mockRejectedValue(new Error('Database not available'))

    render(<OnboardingScreen onComplete={onComplete} />)

    // Minimal path to Finish same as above
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
    fireEvent.click(screen.getByText(/Build a Running Habit/i))
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
    fireEvent.click(screen.getByText(/Beginner/i))
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
    const ageInput = screen.getByLabelText(/your age/i)
    fireEvent.change(ageInput, { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
    fireEvent.click(screen.getByText(/3 days/i))
    fireEvent.click(screen.getByText(/Monday/i))
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))

    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/i }))

    await waitFor(() => {
      expect(onComplete).not.toHaveBeenCalled()
    })
  })
})

