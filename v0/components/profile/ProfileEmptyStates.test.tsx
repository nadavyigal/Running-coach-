import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileEmptyState } from "@/components/profile/ProfileEmptyStates"

describe("ProfileEmptyState", () => {
  it("renders title and description", () => {
    render(<ProfileEmptyState title="No goals yet" description="Create your first goal to get started." />)

    expect(screen.getByText("No goals yet")).toBeInTheDocument()
    expect(screen.getByText("Create your first goal to get started.")).toBeInTheDocument()
  })

  it("renders action button and calls handler", () => {
    const onAction = vi.fn()
    render(
      <ProfileEmptyState
        title="No runs yet"
        description="Record a run to unlock trends."
        actionLabel="Record run"
        onAction={onAction}
      />,
    )

    const button = screen.getByRole("button", { name: "Record run" })
    fireEvent.click(button)

    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
