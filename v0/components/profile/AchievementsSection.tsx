import { Award, Users } from "lucide-react"
import { BadgeCabinet } from "@/components/badge-cabinet"
import { CommunityStatsWidget } from "@/components/community-stats-widget"
import { profileCardVariants } from "@/components/profile/variants"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface AchievementsSectionProps {
  userId: number | null
}

export function AchievementsSection({ userId }: AchievementsSectionProps) {
  return (
    <section aria-labelledby="achievements-heading" className="space-y-3">
      <div>
        <h2 id="achievements-heading" className="text-lg font-semibold">
          Achievements & Community
        </h2>
        <p className="text-sm text-muted-foreground">Track rewards, milestones, and how you compare with your cohort.</p>
      </div>

      <div className={cn(profileCardVariants({ tone: "secondary" }), "p-4")}>
        <Tabs defaultValue="badges" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="badges" className="gap-2">
              <Award className="h-4 w-4" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="community" className="gap-2">
              <Users className="h-4 w-4" />
              Community
            </TabsTrigger>
          </TabsList>

          <TabsContent value="badges" className="mt-3">
            {userId ? (
              <BadgeCabinet userId={userId} />
            ) : (
              <p className="text-sm text-muted-foreground">Badges appear once your profile finishes loading.</p>
            )}
          </TabsContent>

          <TabsContent value="community" className="mt-3">
            {userId ? (
              <CommunityStatsWidget userId={userId} />
            ) : (
              <p className="text-sm text-muted-foreground">Community data appears once your profile finishes loading.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
