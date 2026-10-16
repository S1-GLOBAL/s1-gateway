import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** The Atlas page, drawn before it arrives: the same header, Decode form and dictionary cards (ADR 0013). */
export function AtlasPageSkeleton() {
  return (
    <SkeletonRegion label="Atlas" className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <SkeletonText size="xl" className="w-24" order={0} />
        <SkeletonText size="base" className="w-120 max-w-full" order={1} />
      </div>

      <div className="flex flex-col gap-4">
        <SkeletonText size="lg" className="w-24" order={2} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <SkeletonText size="sm" className="w-16" order={3} />
            <SkeletonBlock className="h-10 w-full" order={3} />
          </div>
          <SkeletonBlock className="h-10 w-24" order={3} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SkeletonText size="lg" className="w-32" order={4} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5, 6].map((card) => (
            <div key={card} className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-5">
              <SkeletonText size="md" className="w-1/3" order={5 + Math.floor(card / 3)} />
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2, 3].map((line) => (
                  <SkeletonText key={line} size="sm" className="w-3/4" order={5 + Math.floor(card / 3)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
