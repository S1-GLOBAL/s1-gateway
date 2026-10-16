import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** A signed-out page, drawn before its code arrives: the logo and a card with two fields (ADR 0013). */
export function AuthPageSkeleton() {
  return (
    <SkeletonRegion label="the page" className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-canvas px-4 py-12">
      <SkeletonBlock className="h-7 w-40" order={0} />
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-surface border border-border bg-surface p-6">
        <SkeletonText size="xl" className="w-32" order={1} />
        <SkeletonBlock className="h-10 w-full" order={2} />
        <SkeletonBlock className="h-10 w-full" order={3} />
        <SkeletonBlock className="h-10 w-full" order={4} />
      </div>
    </SkeletonRegion>
  );
}