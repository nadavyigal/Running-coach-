"use client"

import { AlertCircle, CheckCircle2, Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type BannerTone = "info" | "warning" | "error" | "success"

interface DataQualityBannerProps {
  tone?: BannerTone | null
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

const toneMap: Record<BannerTone, { icon: typeof Info; className: string }> = {
  info: {
    icon: Info,
    className: "border-blue-200 bg-blue-50 text-blue-900",
  },
  warning: {
    icon: AlertCircle,
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-900",
  },
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
}

export function DataQualityBanner({
  tone,
  title,
  description,
  actionLabel,
  onAction,
}: DataQualityBannerProps) {
  if (!tone || !title || !description) return null

  const meta = toneMap[tone]
  const Icon = meta.icon

  return (
    <Alert className={meta.className}>
      <Icon className="h-4 w-4" />
      <div className="space-y-2">
        <AlertTitle className="text-sm font-semibold">{title}</AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">{description}</AlertDescription>
        {actionLabel && onAction ? (
          <Button variant="outline" size="sm" onClick={onAction} className="h-9 border-current/30 bg-transparent">
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}
