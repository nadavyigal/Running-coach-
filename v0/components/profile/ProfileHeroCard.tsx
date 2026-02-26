import { ArrowUpRight, Edit3, LineChart, User } from "lucide-react"
import { profileCardVariants, statusChipVariants } from "@/components/profile/variants"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ProfileHeroCardProps {
  runnerName: string
  runnerLevel: string
  summary: string
  quickFacts: string[]
  onEditProfile: () => void
  onViewProgress: () => void
}

export function ProfileHeroCard({
  runnerName,
  runnerLevel,
  summary,
  quickFacts,
  onEditProfile,
  onViewProgress,
}: ProfileHeroCardProps) {
  const initials = runnerName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <section
      aria-labelledby="profile-hero-heading"
      className={cn(
        profileCardVariants({ tone: "hero" }),
        "relative overflow-hidden p-5 md:p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500",
      )}
    >
      <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-primary/10 blur-2xl" aria-hidden />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-14 w-14 border-2 border-white/70 bg-primary/20 shadow-sm">
            <AvatarFallback className="bg-primary/20 text-base font-bold text-primary">
              {initials || <User className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 id="profile-hero-heading" className="truncate text-2xl font-bold tracking-tight">
              {runnerName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={statusChipVariants({ tone: "active" })}>{runnerLevel}</span>
              <span className="text-xs text-muted-foreground">Runner identity</span>
            </div>
          </div>
        </div>

        <Button variant="secondary" size="sm" className="h-9 gap-1.5" onClick={onEditProfile}>
          <Edit3 className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <p className="relative mt-4 text-sm text-foreground/80">{summary}</p>

      <div className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {quickFacts.map((fact) => (
          <div key={fact} className="rounded-lg border border-white/40 bg-white/55 px-3 py-2 text-sm text-foreground/80">
            {fact}
          </div>
        ))}
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        <Button onClick={onViewProgress} className="h-9 gap-2 px-4">
          <LineChart className="h-4 w-4" />
          View Progress
        </Button>
        <Button variant="outline" className="h-9 gap-2 border-primary/25 bg-card/70">
          <ArrowUpRight className="h-4 w-4" />
          Share Profile
        </Button>
      </div>
    </section>
  )
}
