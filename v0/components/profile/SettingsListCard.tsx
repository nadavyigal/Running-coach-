import { ChevronRight, SlidersHorizontal } from "lucide-react"
import { rowItemVariants, profileCardVariants } from "@/components/profile/variants"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface SettingsRow {
  icon: LucideIcon
  name: string
  description: string
  onClick: () => void
}

interface SettingsListCardProps {
  rows: SettingsRow[]
}

export function SettingsListCard({ rows }: SettingsListCardProps) {
  return (
    <section aria-labelledby="settings-heading" className="space-y-3">
      <div>
        <h2 id="settings-heading" className="text-lg font-semibold">
          Settings
        </h2>
        <p className="text-sm text-muted-foreground">Account and preference controls, grouped for quick scanning.</p>
      </div>

      <div className={cn(profileCardVariants({ tone: "secondary" }), "space-y-2 p-4")}>
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Profile Controls
        </div>
        {rows.map((row) => (
          <button
            key={row.name}
            type="button"
            className={cn(rowItemVariants({ tone: "subtle" }), "w-full p-3 text-left")}
            onClick={row.onClick}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/70">
                  <row.icon className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{row.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{row.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
