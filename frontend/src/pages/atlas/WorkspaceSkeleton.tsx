import { SkeletonBlock, SkeletonText } from '@/shared/ui/Skeleton';

/** A labelled control, drawn before it arrives. */
function SkeletonField({ order }: { order: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SkeletonText size="sm" className="w-24" order={order} />
      <SkeletonBlock className="h-10 w-full" order={order} />
    </div>
  );
}

/** One numbered group of facts. */
function SkeletonGroup({ fields, order }: { fields: number; order: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm">
      <SkeletonText size="md" className="w-40" order={order} />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, field) => (
          <SkeletonField key={field} order={order + 1} />
        ))}
      </div>
    </div>
  );
}

/**
 * The workspace, drawn before it arrives: the groups of facts, and the side
 * column with the name and the code, first at phone width (ADR 0013).
 */
export function WorkspaceSkeleton({ order }: { order: number }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <SkeletonGroup fields={1} order={order + 2} />
        <SkeletonGroup fields={3} order={order + 3} />
        <SkeletonGroup fields={4} order={order + 4} />
      </div>
      <div className="order-first flex min-w-0 flex-col gap-4 lg:order-none">
        <div className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-5 shadow-sm">
          <SkeletonField order={order} />
          <SkeletonBlock className="h-10 w-full" order={order} />
        </div>
        <div className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm">
          <SkeletonText size="sm" className="w-16" order={order + 1} />
          <SkeletonText size="md" className="w-full" order={order + 1} />
          <SkeletonText size="xs" className="w-48" order={order + 1} />
        </div>
      </div>
    </div>
  );
}
