import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChatScreen } from "./chat-screen"

const { mockToast, mockUser, mockRecentRuns } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockUser: {
    id: 1,
    name: "Test User",
    goal: "habit",
    experience: "beginner",
    preferredTimes: ["morning"],
    daysPerWeek: 3,
    onboardingComplete: true,
  },
  mockRecentRuns: [
    { id: 1, distance: 5, duration: 1800, completedAt: new Date(), type: "easy" },
  ],
}))

vi.mock("@/lib/dbUtils", () => ({
  dbUtils: {
    getCurrentUser: vi.fn().mockResolvedValue(mockUser),
    getRunsByUser: vi.fn().mockResolvedValue([
      { id: 1, distance: 5, duration: 1800, completedAt: new Date() },
    ]),
    getPrimaryGoal: vi.fn().mockResolvedValue(null),
    getActivePlan: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock("@/contexts/DataContext", () => {
  const stableData = {
    user: mockUser,
    primaryGoal: null,
    plan: null,
    weeklyStats: {
      runsCompleted: 1,
      totalDistanceKm: 5,
    },
    allTimeStats: {
      totalRuns: 1,
    },
    recentRuns: mockRecentRuns,
    refresh: vi.fn().mockResolvedValue(undefined),
  }

  return {
    useData: () => stableData,
  }
})

vi.mock("@/lib/analytics", () => ({
  trackChatMessageSent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

const historyResponse = {
  ok: true,
  json: vi.fn().mockResolvedValue({ messages: [] }),
}

describe("ChatScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLElement.prototype.scrollIntoView = vi.fn()
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith("/api/chat?")) {
        return Promise.resolve(historyResponse as Response)
      }

      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
        headers: new Headers(),
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('0:{"textDelta":"Hello"}\n'),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      } as unknown as Response)
    }) as typeof fetch
  })

  it("renders core controls with accessible labels", async () => {
    render(<ChatScreen />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show enhanced AI coach" })).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Open coaching preferences" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument()
  })

  it("keeps the failed user message visible and restores the composer on send failure", async () => {
    global.fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url.startsWith("/api/chat?")) {
        return Promise.resolve(historyResponse as Response)
      }

      if (url === "/api/chat" && options?.method === "POST") {
        return Promise.reject(new Error("Network error"))
      }

      return Promise.resolve(historyResponse as Response)
    }) as typeof fetch

    render(<ChatScreen />)

    const input = await screen.findByPlaceholderText("Ask your running coach anything...")
    fireEvent.change(input, { target: { value: "Need help with intervals" } })
    fireEvent.click(screen.getByRole("button", { name: "Send message" }))

    await waitFor(() => {
      expect(screen.getByText("Need help with intervals")).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(
        screen.getByText("I couldn't send that just now. Your message is still here, and I've put it back in the text box so you can retry.")
      ).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue("Need help with intervals")).toBeInTheDocument()
  })
})
