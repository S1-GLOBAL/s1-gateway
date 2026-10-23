import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** Signed-out front door before the chunk arrives (ADR 0013). */
export function LandingPageSkeleton() {
  return (
    <SkeletonRegion label="the Gateway" className="flex min-h-dvh justify-center bg-canvas p-3 sm:p-4 lg:p-6">
      <div className="flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-surface border border-border bg-surface">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-6 sm:px-8">
          <SkeletonBlock className="h-6 w-36" order={0} />
        </div>
        <div className="flex flex-1 flex-col md:flex-row">
          <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-8">
            <div className="flex w-full max-w-lg flex-col gap-4">
              <div className="flex flex-col gap-2">
                <SkeletonText size="3xl" className="w-full max-w-sm" order={1} />
                <SkeletonText size="3xl" className="w-48" order={1} />
              </div>
              <SkeletonText size="md" className="w-56" order={2} />
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-center border-t border-border bg-surface-sunken px-4 py-8 sm:px-8 md:w-[28rem] md:flex-none md:border-t-0 md:border-l">
            <div className="flex w-full flex-col gap-6 rounded-surface border border-border bg-surface p-6">
              <div className="flex justify-center">
                <SkeletonBlock className="h-10 w-14" order={3} />
              </div>
              <SkeletonText size="base" className="w-full" order={3} />
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <SkeletonText size="sm" className="w-12" order={4} />
                  <SkeletonBlock className="h-10 w-full" order={4} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <SkeletonText size="sm" className="w-16" order={5} />
                  <SkeletonBlock className="h-10 w-full" order={5} />
                </div>
                <SkeletonBlock className="h-10 w-full" order={6} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}
