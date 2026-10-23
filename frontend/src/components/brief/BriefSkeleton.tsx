import { Skeleton } from "@/components/ui";

export function BriefSkeleton() {
  return (
    <div className="space-y-12" aria-busy>
      <div className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="mt-6 h-32" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-72" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
