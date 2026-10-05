import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PrimaryGoalCard } from "@/components/profile/PrimaryGoalCard"

const baseHandlers = {
  onCreateGoal: vi.fn(),
  onOpenGoalSettings: vi.fn(),
  onViewPlan: vi.fn(),
}

describe("PrimaryGoalCard", () => {
  it("shows no-goal state and create button", () => {
    render(
      <PrimaryGoalCard
        hasGoal={false}
        progressValue={0}
        coachGuidance="Set your first goal to unlock guidance."
        {...baseHandlers}
      />,
    )

    expect(screen.getByText("Current Goal")).toBeInTheDocument()
    expect(screen.getByText(/No active goal yet/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /create first goal/i }))
    expect(baseHandlers.onCreateGoal).toHaveBeenCalled()
  })

  it("renders active goal details and calls actions", () => {
    const onDeleteGoal = vi.fn()
    render(
      <PrimaryGoalCard
        hasGoal
        goalTitle="Run 10K"
        goalDescription="Build steady endurance in 8 weeks."
        goalTarget="Distance target: 10 km"
        progressValue={42}
        trajectory="on_track"
        daysRemaining={24}
        deadlineLabel="Target date: Mar 30, 2026"
        coachGuidance="Add one threshold session this week."
        onDeleteGoal={onDeleteGoal}
        {...baseHandlers}
      />,
    )

    expect(screen.getByText("Run 10K")).toBeInTheDocument()
    expect(screen.getByText("42%")).toBeInTheDocument()
    expect(screen.getByText(/on track/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /view plan/i }))
    fireEvent.click(screen.getByRole("button", { name: /goal settings/i }))
    fireEvent.click(screen.getByRole("button", { name: /delete primary goal/i }))

    expect(baseHandlers.onViewPlan).toHaveBeenCalled()
    expect(baseHandlers.onOpenGoalSettings).toHaveBeenCalled()
    expect(onDeleteGoal).toHaveBeenCalled()
  })
})
