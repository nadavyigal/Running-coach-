import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AddRunModal } from "./add-run-modal"
import { dbUtils } from "@/lib/dbUtils"

const mockToast = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock("@/lib/dbUtils", () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    ensureUserHasActivePlan: vi.fn(),
    createWorkout: vi.fn(),
    handleDatabaseError: vi.fn(),
  },
}))

describe("AddRunModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(dbUtils.getCurrentUser as any).mockResolvedValue({
      id: 1,
      onboardingComplete: true,
    })
    ;(dbUtils.ensureUserHasActivePlan as any).mockResolvedValue({
      id: 1,
      userId: 1,
      title: "Test Plan",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      endDate: new Date("2026-03-31T00:00:00.000Z"),
      totalWeeks: 4,
      isActive: true,
    })
    ;(dbUtils.createWorkout as any).mockResolvedValue(1)
    ;(dbUtils.handleDatabaseError as any).mockReturnValue({
      title: "Error",
      description: "Could not create workout.",
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        workout: {
          title: "Easy Run Workout",
          description: "A simple easy run",
          duration: "30 min",
          phases: [],
        },
      }),
    }) as typeof fetch
  })

  it("routes the record workout CTA through the callback", async () => {
    const onOpenChange = vi.fn()
    const onRecordWorkout = vi.fn()

    render(
      <AddRunModal
        open={true}
        onOpenChange={onOpenChange}
        onRecordWorkout={onRecordWorkout}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /record workout/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onRecordWorkout).toHaveBeenCalledTimes(1)
  })

  it("shows an honest fallback notice when personalized generation fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: "Generation failed",
      }),
    }) as typeof fetch

    render(<AddRunModal open={true} onOpenChange={() => undefined} />)

    fireEvent.click(screen.getByText("Easy Run"))
    fireEvent.click(await screen.findByRole("button", { name: /generate workout plan/i }))

    expect(await screen.findByText("Starter workout shown")).toBeInTheDocument()
    expect(
      screen.getByText("We could not generate a personalized version right now, so this fallback keeps you moving safely.")
    ).toBeInTheDocument()
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Using a starter workout" })
    )
  })

  it("shows success feedback when scheduling the generated workout", async () => {
    render(<AddRunModal open={true} onOpenChange={() => undefined} />)

    fireEvent.click(screen.getByText("Easy Run"))
    fireEvent.click(await screen.findByRole("button", { name: /generate workout plan/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /schedule workout/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /schedule workout/i }))

    await waitFor(() => {
      expect(dbUtils.createWorkout).toHaveBeenCalled()
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Workout Scheduled!") })
    )
  })
})
