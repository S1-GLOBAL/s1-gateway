import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';
import { WorkspaceSkeleton } from './WorkspaceSkeleton';

/**
 * `/atlas/:id`, drawn before it arrives: the way back, the name with its
 * badge, who changed it, History and Save changes, and the workspace (ADR 0013).
 */
export function SpecIdPageSkeleton() {
  return (
    <SkeletonRegion label="Spec ID" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <SkeletonText size="sm" className="w-16" order={0} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <SkeletonText size="xl" className="w-56" order={0} />
              <SkeletonBlock className="h-5 w-20 rounded-full" order={0} />
            </div>
            <SkeletonText size="sm" className="w-96 max-w-full" order={1} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SkeletonBlock className="h-10 w-10" order={1} />
            <SkeletonBlock className="h-10 w-32" order={1} />
          </div>
        </div>
      </div>
      <WorkspaceSkeleton order={2} />
    </SkeletonRegion>
  );
}
