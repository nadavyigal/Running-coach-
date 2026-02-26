import { profileCardVariants } from "@/components/profile/variants"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"


type Tone = "neutral" | "positive" | "warning"

export interface ProfileStatCardProps {
  icon: LucideIcon
  label: string
  value: string
  helper?: string
  tone?: Tone
  sparkline?: number[]
  className?: string
}

const toneClass: Record<Tone, string> = {
  neutral: "text-foreground",
  positive: "text-primary",
  warning: "text-amber-700",
}

export function ProfileStatCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "neutral",
  sparkline,
  className,
}: ProfileStatCardProps) {
  return (
    <article className={cn(profileCardVariants({ tone: "secondary" }), "p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </span>
      </div>

      <p className={cn("text-2xl font-bold leading-none tracking-tight", toneClass[tone])}>{value}</p>

      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}

      {sparkline && sparkline.length > 1 ? (
        <div className="mt-3 flex h-8 items-end gap-1">
          {sparkline.map((point, index) => {
            const clamped = Number.isFinite(point) ? Math.min(Math.max(point, 0), 100) : 0
            return (
              <span
                key={`${label}-${index}`}
                className="w-full rounded-sm bg-primary/20 transition-all duration-500 motion-reduce:transition-none"
                style={{ height: `${Math.max(12, clamped)}%` }}
                aria-hidden
              />
            )
          })}
        </div>
      ) : null}
    </article>
  )
}
