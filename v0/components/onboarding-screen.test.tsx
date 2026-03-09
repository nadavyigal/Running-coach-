import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OnboardingScreen } from "./onboarding-screen"
import { dbUtils } from "@/lib/dbUtils"

const mockToast = vi.fn()
const mockOnComplete = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock("@/lib/dbUtils", () => ({
  dbUtils: {
    completeOnboardingAtomic: vi.fn(),
    getPlan: vi.fn().mockResolvedValue({
      startDate: new Date("2026-03-09T00:00:00.000Z"),
    }),
    updatePlanWithAIWorkouts: vi.fn().mockResolvedValue(undefined),
  },
  setReferenceRace: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/onboardingAnalytics", () => ({
  trackOnboardingStarted: vi.fn(),
  trackStepProgression: vi.fn(),
  trackFormValidationError: vi.fn(),
  trackUserContext: vi.fn(),
  OnboardingSessionTracker: class {
    startStep() {}
    completeStep() {}
  },
}))

vi.mock("@/lib/analytics", () => ({
  trackOnboardComplete: vi.fn(),
  trackOnboardingCompletedFunnel: vi.fn(),
}))

vi.mock("@/components/error-toast", () => ({
  useErrorToast: () => ({
    showError: vi.fn(),
  }),
  NetworkStatusIndicator: () => null,
}))

vi.mock("@/hooks/use-network-error-handling", () => ({
  useNetworkErrorHandling: () => ({
    isOnline: true,
  }),
}))

vi.mock("@/hooks/use-database-error-handling", () => ({
  useDatabaseErrorHandling: () => ({
    checkDatabaseHealth: vi.fn().mockResolvedValue({
      isHealthy: true,
      canWrite: true,
    }),
    recoverFromDatabaseError: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock("@/hooks/use-ai-service-error-handling", () => ({
  useAIServiceErrorHandling: () => undefined,
}))

vi.mock("@/lib/onboardingManager", () => ({
  onboardingManager: {
    isOnboardingInProgress: vi.fn().mockReturnValue(false),
    resetOnboardingState: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock("@/lib/challengeTemplates", () => ({
  getChallengeTemplateBySlug: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/challenge-plan-sync", () => ({
  syncPlanWithChallenge: vi.fn().mockResolvedValue({
    planUpdated: true,
  }),
}))

const goToSummaryStep = async () => {
  fireEvent.click(screen.getByText(/Build a running habit/i))
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }))

  fireEvent.click(screen.getByText(/Beginner/i))
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }))

  fireEvent.change(screen.getByLabelText(/Your age/i), { target: { value: "30" } })
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }))

  fireEvent.click(screen.getByRole("button", { name: /Continue/i }))

  fireEvent.click(screen.getByText(/3 days/i))
  fireEvent.click(screen.getByText(/Monday/i))
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }))

  await waitFor(() => {
    expect(screen.getByText(/Summary and confirmation/i)).toBeInTheDocument()
  })
}

describe("OnboardingScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ plan: { workouts: [] } }),
    }) as typeof fetch
    ;(dbUtils.completeOnboardingAtomic as any).mockResolvedValue({
      userId: 1,
      planId: 1,
    })
  })

  it("uses an accessible back button label and shows the updated final CTA copy", async () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />)

    expect(
      screen.getByRole("button", { name: "Go back to the previous onboarding step" })
    ).toBeInTheDocument()

    await goToSummaryStep()
    fireEvent.click(screen.getByLabelText(/I have read and agree/i))

    expect(screen.getByText("Finish setup to save your profile and create your starter plan.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create my plan" })).toBeEnabled()
  })

  it("shows a live final-step status and disables back navigation while setup is in progress", async () => {
    ;(dbUtils.completeOnboardingAtomic as any).mockImplementation(
      () => new Promise(() => undefined)
    )

    render(<OnboardingScreen onComplete={mockOnComplete} />)

    await goToSummaryStep()
    fireEvent.click(screen.getByLabelText(/I have read and agree/i))
    fireEvent.click(screen.getByRole("button", { name: "Create my plan" }))

    await waitFor(() => {
      expect(screen.getByText("Saving your profile and creating your starter plan. This may take a few seconds.")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Go back to the previous onboarding step" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Creating your plan..." })).toBeDisabled()
  })
})
