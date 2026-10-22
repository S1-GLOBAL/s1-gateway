import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/**
 * The Atlas library, drawn before it arrives: the header with Dictionary and
 * New Spec ID, the search box, the product-type filter, and three cards (ADR 0013).
 */
export function AtlasPageSkeleton() {
  return (
    <SkeletonRegion label="Atlas" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <SkeletonText size="xl" className="w-24" order={0} />
          <SkeletonText size="base" className="w-120 max-w-full" order={1} />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-32" order={1} />
          <SkeletonBlock className="h-10 w-36" order={1} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <SkeletonText size="sm" className="w-16" order={2} />
          <SkeletonBlock className="h-10 w-full" order={2} />
        </div>
        <div className="flex flex-col gap-2">
          <SkeletonText size="sm" className="w-36" order={3} />
          <SkeletonBlock className="h-8 w-96 max-w-full" order={3} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((card) => (
          <SkeletonBlock key={card} className="h-32 w-full rounded-surface" order={4 + card} />
        ))}
      </div>
    </SkeletonRegion>
  );
}
