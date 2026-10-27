import { SkeletonBlock, SkeletonText } from '@/shared/ui/Skeleton';

/** Two suggestion cards, drawn before a list arrives: a title, two changed fields, and the actions (ADR 0013). */
export function SuggestionListSkeleton({ firstOrder = 0 }: { firstOrder?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {[0, 1].map((card) => (
        <div key={card} className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5">
          <div className="flex flex-col gap-1">
            <SkeletonText size="md" className="w-1/2" order={firstOrder + card * 2} />
            <SkeletonText size="xs" className="w-1/3" order={firstOrder + card * 2} />
          </div>
          <SkeletonText size="sm" className="w-2/3" order={firstOrder + card * 2 + 1} />
          <SkeletonText size="sm" className="w-1/2" order={firstOrder + card * 2 + 1} />
          <div className="flex gap-2">
            <SkeletonBlock className="h-10 w-24" order={firstOrder + card * 2 + 1} />
            <SkeletonBlock className="h-10 w-24" order={firstOrder + card * 2 + 1} />
          </div>
        </div>
      ))}
    </div>
  );
}
