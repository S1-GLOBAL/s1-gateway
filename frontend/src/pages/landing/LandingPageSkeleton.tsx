import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** Signed-out front door before the chunk arrives (ADR 0013). */
export function LandingPageSkeleton() {
  return (
    <SkeletonRegion
      label="the Gateway"
      className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-canvas px-4 py-12"
    >
      <SkeletonBlock className="h-10 w-48" order={0} />
      <div className="flex w-full max-w-md flex-col items-center gap-2">
        <SkeletonText size="2xl" className="w-64" order={1} />
        <SkeletonText size="base" className="w-72" order={2} />
      </div>
      <SkeletonBlock className="h-10 w-28" order={3} />
    </SkeletonRegion>
  );
}
