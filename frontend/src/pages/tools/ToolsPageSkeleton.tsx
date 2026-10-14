import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** The Tools page, drawn before it arrives: the same header, groups and card grid (ADR 0013). */
export function ToolsPageSkeleton() {
  return (
    <SkeletonRegion label="tools" className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <SkeletonText size="xl" className="w-28" order={0} />
          <SkeletonText size="base" className="w-80 max-w-full" order={1} />
        </div>
        <SkeletonBlock className="h-10 w-28" order={1} />
      </div>
      {[0, 1].map((group) => (
        <div key={group} className="flex flex-col gap-4">
          <SkeletonText size="sm" className="w-24" order={2 + group * 2} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <div key={card} className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5">
                <SkeletonBlock className="size-9" order={3 + group * 2} />
                <div className="flex flex-col gap-1">
                  <SkeletonText size="md" className="w-2/3" order={3 + group * 2} />
                  <SkeletonText size="xs" className="w-1/2" order={3 + group * 2} />
                </div>
                <SkeletonText size="sm" className="w-full" order={3 + group * 2} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
