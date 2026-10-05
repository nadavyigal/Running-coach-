import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingScreen } from '@/components/onboarding-screen'

import 'fake-indexeddb/auto'

const mockRefresh = vi.hoisted(() => vi.fn())
const mockCompleteOnboardingAtomic = vi.hoisted(() => vi.fn())
const mockGetPlan = vi.hoisted(() => vi.fn())
const mockSetReferenceRace = vi.hoisted(() => vi.fn())
const mockTrackOnboardComplete = vi.hoisted(() => vi.fn())
const mockTrackOnboardingCompletedFunnel = vi.hoisted(() => vi.fn())
const mockToast = vi.hoisted(() => vi.fn())

vi.mock('@/contexts/DataContext', () => ({
  useData: () => ({
    refresh: mockRefresh,
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/components/error-toast', () => ({
  useErrorToast: () => ({
    showErrorToast: vi.fn(),
  }),
  NetworkStatusIndicator: () => null,
}))

vi.mock('@/hooks/use-network-error-handling', () => ({
  useNetworkErrorHandling: () => ({
    isOnline: true,
    retryRequest: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-database-error-handling', () => ({
  useDatabaseErrorHandling: () => ({
    recoverFromDatabaseError: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/hooks/use-ai-service-error-handling', () => ({
  useAIServiceErrorHandling: () => ({
    isAIAvailable: true,
  }),
}))

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    completeOnboardingAtomic: mockCompleteOnboardingAtomic,
    getPlan: mockGetPlan,
    updatePlanWithAIWorkouts: vi.fn(),
  },
  setReferenceRace: mockSetReferenceRace,
}))

vi.mock('@/lib/analytics', () => ({
  trackOnboardComplete: mockTrackOnboardComplete,
  trackOnboardingCompletedFunnel: mockTrackOnboardingCompletedFunnel,
  trackAnalyticsEvent: vi.fn(),
}))

function completeOnboardingForm() {
  fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
  fireEvent.click(screen.getByText(/build a running habit/i))
  fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
  fireEvent.click(screen.getByText(/^beginner$/i))
  fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
  fireEvent.change(screen.getByLabelText(/your age/i), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
  fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
  fireEvent.click(screen.getByText(/3 days/i))
  fireEvent.click(screen.getByText(/monday/i))
  fireEvent.click(screen.getByRole('button', { name: /continue|next/i }))
  fireEvent.click(screen.getByLabelText(/i have read and agree/i))
}

describe('OnboardingScreen - Atomic Finish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCompleteOnboardingAtomic.mockResolvedValue({ userId: 1, planId: 11 })
    mockGetPlan.mockResolvedValue({
      id: 11,
      startDate: new Date('2026-03-09T00:00:00.000Z'),
    })
    mockSetReferenceRace.mockResolvedValue(undefined)
    mockRefresh.mockResolvedValue(undefined)
    mockTrackOnboardComplete.mockResolvedValue(undefined)
    mockTrackOnboardingCompletedFunnel.mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ fallbackRequired: true }),
      })
    )
  })

  it('commits onboarding, refreshes state, fires onboard_complete, and navigates', async () => {
    const onComplete = vi.fn()

    render(<OnboardingScreen onComplete={onComplete} />)
    completeOnboardingForm()

    fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

    await waitFor(() => {
      expect(mockCompleteOnboardingAtomic).toHaveBeenCalled()
      expect(mockRefresh).toHaveBeenCalled()
      expect(onComplete).toHaveBeenCalled()
    })

    expect(mockTrackOnboardComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        age: 25,
        goalDist: 0,
        rookieChallenge: false,
      })
    )
    expect(mockTrackOnboardingCompletedFunnel).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 'habit',
        daysPerWeek: 3,
      })
    )
  })

  it('keeps the user on the final step when the atomic commit fails', async () => {
    const onComplete = vi.fn()
    mockCompleteOnboardingAtomic.mockRejectedValue(new Error('Database not available'))

    render(<OnboardingScreen onComplete={onComplete} />)
    completeOnboardingForm()

    fireEvent.click(screen.getByRole('button', { name: /complete setup/i }))

    await waitFor(() => {
      expect(mockCompleteOnboardingAtomic).toHaveBeenCalled()
      expect(onComplete).not.toHaveBeenCalled()
    })

    expect(screen.getByRole('heading', { name: /summary and confirmation/i })).toBeInTheDocument()
    expect(mockTrackOnboardComplete).not.toHaveBeenCalled()
  })
})

