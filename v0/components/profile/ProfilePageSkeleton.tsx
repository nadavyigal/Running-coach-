import { Skeleton } from "@/components/ui/skeleton"

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading profile screen">
      <div className="rounded-2xl border p-5">
        <div className="mb-3 flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-10/12" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>

      <div className="rounded-2xl border p-5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-4 h-2.5 w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
