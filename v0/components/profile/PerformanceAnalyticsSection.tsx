import { BarChart3, CalendarRange, Download, Gauge } from "lucide-react"
import { PerformanceAnalyticsDashboard } from "@/components/performance-analytics-dashboard"
import { profileCardVariants, statusChipVariants } from "@/components/profile/variants"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

interface PerformanceAnalyticsSectionProps {
  userId: number | null
  totalRuns: number
  weeklyRuns: number
  consistencyScore: number
}

export function PerformanceAnalyticsSection({
  userId,
  totalRuns,
  weeklyRuns,
  consistencyScore,
}: PerformanceAnalyticsSectionProps) {
  return (
    <section aria-labelledby="analytics-heading" className="space-y-3">
      <div>
        <h2 id="analytics-heading" className="text-lg font-semibold">
          Performance Analytics
        </h2>
        <p className="text-sm text-muted-foreground">Insight first, controls second. Open details when you want the full dashboard.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={cn(profileCardVariants({ tone: "secondary" }), "p-4")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Runs (all time)</p>
          <div className="mt-2 inline-flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <p className="text-2xl font-bold">{totalRuns}</p>
          </div>
        </div>
        <div className={cn(profileCardVariants({ tone: "secondary" }), "p-4")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weekly Rhythm</p>
          <div className="mt-2 inline-flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            <p className="text-2xl font-bold">{weeklyRuns}/7</p>
          </div>
        </div>
        <div className={cn(profileCardVariants({ tone: "secondary" }), "p-4")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consistency Score</p>
          <div className="mt-2 inline-flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <p className="text-2xl font-bold">{Math.round(consistencyScore)}%</p>
          </div>
        </div>
      </div>

      <Accordion type="single" collapsible defaultValue="analytics" className={cn(profileCardVariants({ tone: "secondary" }), "px-4")}>
        <AccordionItem value="analytics" className="border-b-0">
          <AccordionTrigger className="py-3 no-underline hover:no-underline">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              Detailed Analytics
              <span className={statusChipVariants({ tone: "neutral" })}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export tools inside
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {userId ? (
              <PerformanceAnalyticsDashboard userId={userId} />
            ) : (
              <p className="text-sm text-muted-foreground">No analytics available until your profile is loaded.</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}
