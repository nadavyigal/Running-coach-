import type { ReactNode } from "react"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DailyFocusCard } from "@/components/today/DailyFocusCard"
import { DataQualityBanner } from "@/components/today/DataQualityBanner"
import { KeyMetricsGrid, type KeyMetric } from "@/components/today/KeyMetricsGrid"
import { ProgressSummaryChart } from "@/components/today/ProgressSummaryChart"
import { TodayWorkoutCard } from "@/components/today/TodayWorkoutCard"

vi.mock("recharts", () => {
  const Responsive = ({ children }: { children?: ReactNode }) => <div data-testid="chart-container">{children}</div>
  const SvgContainer = ({ children }: { children?: ReactNode }) => <svg data-testid="chart-svg">{children}</svg>
  return {
    ResponsiveContainer: Responsive,
    AreaChart: SvgContainer,
    Area: () => <path data-testid="chart-area" />,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  }
})

describe("Today visual snapshots", () => {
  it("matches hero card snapshot", () => {
    const { container } = render(
      <DailyFocusCard
        dateLabel="Thursday, February 26"
        statusLabel="Workout day"
        statusTone="positive"
        headline="Tempo focus"
        coachInsight="Keep breathing smooth and settle into pace after the first 5 minutes."
        primaryAction={{ label: "Start Run", onClick: () => undefined }}
        secondaryActions={[
          { label: "View Plan", onClick: () => undefined },
          { label: "Sync", onClick: () => undefined },
        ]}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it("matches metrics grid snapshot", () => {
    const metrics: KeyMetric[] = [
      {
        id: "readiness",
        label: "Readiness",
        value: "78",
        animatedValue: 78,
        unit: "/100",
        helper: "Higher than usual recovery baseline",
        tone: "positive",
        trend: "up",
        trendLabel: "Rising",
        meterValue: 78,
      },
      {
        id: "weekly",
        label: "Weekly Progress",
        value: "2/4",
        animatedValue: 2,
        formatAnimatedValue: (value) => `${Math.round(value)}/4`,
        helper: "Completed vs planned runs this week",
        tone: "default",
        trend: "stable",
        trendLabel: "In progress",
        meterValue: 50,
      },
      {
        id: "consistency",
        label: "Consistency",
        value: "67%",
        animatedValue: 67,
        formatAnimatedValue: (value) => `${Math.round(value)}%`,
        helper: "One extra session gets you back on track",
        tone: "caution",
        trend: "down",
        trendLabel: "Needs lift",
        meterValue: 67,
      },
      {
        id: "confidence",
        label: "Coach Confidence",
        value: "72%",
        animatedValue: 72,
        formatAnimatedValue: (value) => `${Math.round(value)}%`,
        helper: "Good confidence from your recent sessions",
        tone: "positive",
        trend: "up",
        trendLabel: "Trusted",
        meterValue: 72,
      },
    ]

    const { container } = render(<KeyMetricsGrid metrics={metrics} />)

    expect(container.firstChild).toMatchSnapshot()
  })

  it("matches progress chart snapshot", () => {
    const { container } = render(
      <ProgressSummaryChart
        progressPercent={62}
        summaryLabel="2 of 4 planned runs completed"
        data={[
          { day: "Mon", completion: 100 },
          { day: "Tue", completion: 0 },
          { day: "Wed", completion: 50 },
          { day: "Thu", completion: 35 },
          { day: "Fri", completion: 0 },
        ]}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it("matches data quality banner snapshot", () => {
    const { container } = render(
      <DataQualityBanner
        tone="warning"
        title="Partial data today"
        description="Add sleep or wellness inputs to improve recommendation quality."
        actionLabel="Add Activity"
        onAction={() => undefined}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it("matches workout card snapshot", () => {
    const workout = {
      id: 101,
      type: "tempo",
      distance: 8,
      duration: 50,
      planId: 10,
      week: 3,
      day: "Thu",
      completed: false,
      scheduledDate: new Date("2026-02-26T08:00:00.000Z"),
      createdAt: new Date("2026-02-01T08:00:00.000Z"),
      updatedAt: new Date("2026-02-20T08:00:00.000Z"),
    }

    const { container } = render(
      <TodayWorkoutCard
        isLoading={false}
        workout={workout}
        structuredWorkout={null}
        selectedRoute={null}
        workoutDistanceLabel="8.0 km • 50 min"
        workoutCoachCue="Stay controlled through the first half and finish strong."
        goalProgressPercent={58}
        showBreakdown={false}
        onToggleBreakdown={() => undefined}
        onStartRun={() => undefined}
        onSelectRoute={() => undefined}
      />
    )

    expect(container.firstChild).toMatchSnapshot()
  })
})
