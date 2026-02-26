import { profileCardVariants } from "@/components/profile/variants"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ProfileEmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function ProfileEmptyState({ title, description, actionLabel, onAction }: ProfileEmptyStateProps) {
  return (
    <div className={cn(profileCardVariants({ tone: "muted" }), "p-5")}>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button onClick={onAction} className="mt-4 h-9">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
