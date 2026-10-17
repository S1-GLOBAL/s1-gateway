import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** The Accounts page, drawn before it arrives: the header with Invite, and four sections of rows (ADR 0013). */
export function AccountsPageSkeleton() {
  return (
    <SkeletonRegion label="accounts" className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <SkeletonText size="xl" className="w-32" order={0} />
          <SkeletonText size="base" className="w-96 max-w-full" order={1} />
        </div>
        <SkeletonBlock className="h-10 w-28" order={1} />
      </div>
      {[0, 1, 2, 3].map((section) => (
        <div key={section} className="flex flex-col gap-4">
          <SkeletonText size="lg" className="w-28" order={2 + section * 2} />
          <div className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-5">
            <SkeletonText size="md" className="w-1/3" order={3 + section * 2} />
            <SkeletonText size="xs" className="w-1/2" order={3 + section * 2} />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
