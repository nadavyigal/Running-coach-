"use client"

import type { ReactNode } from "react"

type RechartsTooltipPayload = Array<{
  value?: number | string
}> | undefined

interface TodayChartTooltipContentProps {
  active?: boolean
  payload?: RechartsTooltipPayload
  label?: string
  valueLabel: string
  valueSuffix?: string
}

interface TodayChartEmptyStateProps {
  title: string
  description: string
}

interface TodayChartPanelProps {
  children: ReactNode
}

export const todayChartAxisTick = {
  fill: "oklch(var(--muted-foreground))",
  fontSize: 11,
} as const

export const todayChartGridStroke = "oklch(var(--border))"

export function TodayChartTooltipContent({
  active,
  payload,
  label,
  valueLabel,
  valueSuffix = "",
}: TodayChartTooltipContentProps) {
  if (!active || !payload?.length) return null
  const rawValue = payload[0]?.value
  const formatted = typeof rawValue === "number" ? `${rawValue}${valueSuffix}` : `${rawValue ?? "--"}${valueSuffix}`

  return (
    <div className="rounded-xl border border-border/80 bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{label ?? "Today"}</p>
      <p className="mt-0.5 text-muted-foreground">
        {valueLabel} <span className="font-semibold text-foreground">{formatted}</span>
      </p>
    </div>
  )
}

export function TodayChartEmptyState({ title, description }: TodayChartEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

export function TodayChartPanel({ children }: TodayChartPanelProps) {
  return <div className="h-40 w-full rounded-2xl border border-border/65 bg-background/75 p-2">{children}</div>
}

