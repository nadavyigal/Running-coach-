import { Brain, Settings2, Sparkles } from "lucide-react"
import { CoachingInsightsWidget } from "@/components/coaching-insights-widget"
import { profileCardVariants, statusChipVariants } from "@/components/profile/variants"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CoachingProfilePanelProps {
  userId: number | null
  coachingStyle?: string | null
  onOpenSettings: () => void
}

export function CoachingProfilePanel({ userId, coachingStyle, onOpenSettings }: CoachingProfilePanelProps) {
  return (
    <section aria-labelledby="coaching-heading" className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 id="coaching-heading" className="text-lg font-semibold">
            Adaptive Coaching Profile
          </h2>
          <p className="text-sm text-muted-foreground">Your preferences shape coaching tone, detail, and recommendations.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenSettings} className="h-8 gap-2">
          <Settings2 className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className={cn(profileCardVariants({ tone: "secondary" }), "p-4")}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={statusChipVariants({ tone: "active" })}>
            <Brain className="mr-1 h-3.5 w-3.5" />
            Coaching score aware
          </span>
          <span className={statusChipVariants({ tone: "neutral" })}>
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            {coachingStyle ? `Style: ${coachingStyle}` : "Style: adaptive"}
          </span>
        </div>
        {userId ? (
          <CoachingInsightsWidget
            userId={userId}
            showDetails={false}
            onSettingsClick={onOpenSettings}
            className="border-none shadow-none"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Load your profile to see coaching insights.</p>
        )}
      </div>
    </section>
  )
}
