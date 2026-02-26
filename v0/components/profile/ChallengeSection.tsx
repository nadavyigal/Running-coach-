import Link from "next/link"
import { Activity, CalendarDays, Flame, History, Loader2, Trophy } from "lucide-react"
import { profileCardVariants, statusChipVariants } from "@/components/profile/variants"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { DailyChallengeData } from "@/lib/challengeEngine"
import { getActiveChallengeTemplates } from "@/lib/challengeTemplates"
import type { ChallengeProgress, ChallengeTemplate } from "@/lib/db"
import { cn } from "@/lib/utils"

type ActiveChallenge = {
  progress: ChallengeProgress
  template: ChallengeTemplate
  dailyData: DailyChallengeData
}

type ChallengeTemplateSeed = ReturnType<typeof getActiveChallengeTemplates>[number]

interface ChallengeSectionProps {
  isLoading: boolean
  activeChallenge: ActiveChallenge | null
  challengeHistory: Array<{ progress: ChallengeProgress; template: ChallengeTemplate }>
  availableChallenges: ChallengeTemplateSeed[]
  joiningChallengeSlug: string | null
  onJoinChallenge: (template: ChallengeTemplateSeed) => void
}

export function ChallengeSection({
  isLoading,
  activeChallenge,
  challengeHistory,
  availableChallenges,
  joiningChallengeSlug,
  onJoinChallenge,
}: ChallengeSectionProps) {
  return (
    <section aria-labelledby="challenges-heading" className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 id="challenges-heading" className="text-lg font-semibold">
            Challenges & Motivation
          </h2>
          <p className="text-sm text-muted-foreground">Retention engine: join, progress, and celebrate consistency.</p>
        </div>
      </div>

      {isLoading ? (
        <div className={cn(profileCardVariants({ tone: "secondary" }), "p-6 text-center")}>
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading challenges...</p>
        </div>
      ) : null}

      {!isLoading && activeChallenge ? (
        <article className={cn(profileCardVariants({ tone: "primary" }), "p-5")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className={statusChipVariants({ tone: "active" })}>Featured Challenge</span>
                <span className="text-xs text-muted-foreground">Day {activeChallenge.dailyData.currentDay}</span>
              </div>
              <h3 className="text-xl font-bold">{activeChallenge.template.name}</h3>
              <p className="text-sm text-muted-foreground">{activeChallenge.template.tagline}</p>
            </div>
            <Badge variant="secondary">{activeChallenge.template.durationDays} days</Badge>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold text-primary">{activeChallenge.dailyData.progress}%</span>
            </div>
            <Progress value={activeChallenge.dailyData.progress} className="h-2" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p className="rounded-lg border bg-[oklch(var(--surface-2))] px-3 py-2 text-sm">{activeChallenge.dailyData.dayTheme}</p>
            <div className="flex items-center gap-3 rounded-lg border bg-[oklch(var(--surface-2))] px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Flame className="h-4 w-4 text-primary" />
                {activeChallenge.dailyData.streakDays}-day streak
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-4 w-4 text-primary" />
                {activeChallenge.dailyData.daysRemaining} days left
              </span>
            </div>
          </div>
        </article>
      ) : null}

      {!isLoading && !activeChallenge && challengeHistory.length === 0 ? (
        <div className={cn(profileCardVariants({ tone: "muted" }), "p-5")}>
          <h3 className="text-base font-semibold">No challenge yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Start one today to build consistency and unlock streak momentum.</p>
        </div>
      ) : null}

      {!isLoading ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Available Challenges</h3>
          {availableChallenges.length === 0 ? (
            <div className={cn(profileCardVariants({ tone: "muted" }), "p-4 text-sm text-muted-foreground")}>
              No challenges available right now.
            </div>
          ) : (
            <div className="flex snap-x gap-3 overflow-x-auto pb-1">
              {availableChallenges.map((template) => {
                const isActive = activeChallenge?.template.slug === template.slug
                const isJoining = joiningChallengeSlug === template.slug
                return (
                  <article
                    key={template.slug}
                    className={cn(
                      profileCardVariants({ tone: isActive ? "primary" : "secondary" }),
                      "min-w-[250px] max-w-[250px] snap-start p-4",
                    )}
                  >
                    <h4 className="text-base font-semibold">{template.name}</h4>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.tagline}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="capitalize">
                        {template.difficulty}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {template.category}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/challenges/${template.slug}`}>Details</Link>
                      </Button>
                      <Button size="sm" onClick={() => onJoinChallenge(template)} disabled={isActive || isJoining}>
                        {isActive ? "Active" : isJoining ? "Joining..." : "Join"}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {!isLoading && challengeHistory.length > 0 ? (
        <Accordion type="single" collapsible className={cn(profileCardVariants({ tone: "secondary" }), "px-4")}>
          <AccordionItem value="history" className="border-b-0">
            <AccordionTrigger className="py-3 no-underline hover:no-underline">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4 text-muted-foreground" />
                Past Challenges ({challengeHistory.length})
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              {challengeHistory.map((challenge) => (
                <div key={challenge.progress.id} className="rounded-xl border bg-[oklch(var(--surface-2))] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold">{challenge.template.name}</h4>
                      <p className="text-xs text-muted-foreground">{challenge.template.tagline}</p>
                    </div>
                    <span className={statusChipVariants({ tone: challenge.progress.status === "completed" ? "connected" : "neutral" })}>
                      {challenge.progress.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-primary" />
                      {challenge.progress.streakDays} day streak
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-amber-600" />
                      {challenge.progress.totalDaysCompleted} runs
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                      {challenge.template.durationDays} days
                    </span>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </section>
  )
}
