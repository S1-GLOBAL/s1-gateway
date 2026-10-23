import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/**
 * `/atlas/:id/manufacturers`, drawn before it arrives: the way back, the
 * eyebrow, name and code with Open Spec ID, then one group of manufacturer
 * cards (ADR 0013).
 */
export function ManufacturersPageSkeleton() {
  return (
    <SkeletonRegion label="Manufacturers" className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <SkeletonText size="sm" className="w-16" order={0} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <SkeletonText size="xs" className="w-24" order={0} />
            <SkeletonText size="xl" className="w-64 max-w-full" order={0} />
            <SkeletonText size="sm" className="w-96 max-w-full" order={1} />
          </div>
          <SkeletonBlock className="h-10 w-32 shrink-0" order={1} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <SkeletonText size="lg" className="w-48" order={2} />
        {[0, 1].map((card) => (
          <SkeletonBlock key={card} className="h-48 w-full rounded-surface" order={3 + card} />
        ))}
      </div>
    </SkeletonRegion>
  );
}
