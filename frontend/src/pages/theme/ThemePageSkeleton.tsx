import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** The Theme page's header and its first two sections (ADR 0013). */
export function ThemePageSkeleton() {
  return (
    <SkeletonRegion label="theme" className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <SkeletonText size="xl" className="w-28" order={0} />
        <SkeletonText size="base" className="w-[28rem] max-w-full" order={1} />
      </div>
      {[0, 1].map((section) => (
        <div key={section} className="grid gap-6 border-t border-border pt-10 lg:grid-cols-[220px_1fr] lg:gap-10">
          <div className="flex flex-col gap-1">
            <SkeletonText size="xs" className="w-6" order={2 + section * 2} />
            <SkeletonText size="lg" className="w-24" order={2 + section * 2} />
            <SkeletonText size="sm" className="w-full" order={2 + section * 2} />
            <SkeletonText size="sm" className="w-3/4" order={2 + section * 2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SkeletonBlock className="h-36 rounded-surface sm:col-span-2" order={3 + section * 2} />
            <SkeletonBlock className="h-36 rounded-surface" order={3 + section * 2} />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
