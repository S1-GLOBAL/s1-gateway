import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** Atlas before it arrives: the three tabs, and the search field (ADR 0013). */
export function AtlasPageSkeleton() {
  return (
    <SkeletonRegion label="Atlas" className="flex flex-col gap-10">
      <div className="flex gap-2 border-b border-border pb-3">
        <SkeletonBlock className="h-5 w-16" order={0} />
        <SkeletonBlock className="h-5 w-16" order={0} />
        <SkeletonBlock className="h-5 w-20" order={0} />
      </div>
      <div className="flex flex-col gap-1.5">
        <SkeletonText size="sm" className="w-16" order={2} />
        <SkeletonBlock className="h-10 w-full" order={3} />
      </div>
    </SkeletonRegion>
  );
}
