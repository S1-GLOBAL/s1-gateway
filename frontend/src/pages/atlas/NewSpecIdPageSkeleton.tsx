import { SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';
import { WorkspaceSkeleton } from './WorkspaceSkeleton';

/** `/atlas/new`, drawn before it arrives: the way back, the header, and the workspace (ADR 0013). */
export function NewSpecIdPageSkeleton() {
  return (
    <SkeletonRegion label="New Spec ID" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <SkeletonText size="sm" className="w-16" order={0} />
        <div className="flex flex-col gap-1">
          <SkeletonText size="xl" className="w-40" order={0} />
          <SkeletonText size="base" className="w-120 max-w-full" order={1} />
        </div>
      </div>
      <WorkspaceSkeleton order={2} />
    </SkeletonRegion>
  );
}
