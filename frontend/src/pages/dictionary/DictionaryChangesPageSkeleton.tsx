import { SuggestionListSkeleton } from '@/features/atlas';
import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** The Dictionary changes page, drawn before it arrives: the header, the two tabs, and two cards (ADR 0013). */
export function DictionaryChangesPageSkeleton() {
  return (
    <SkeletonRegion label="dictionary changes" className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <SkeletonText size="xl" className="w-56" order={0} />
        <SkeletonText size="base" className="w-96 max-w-full" order={1} />
      </div>
      <div className="flex flex-col gap-6">
        <SkeletonBlock className="h-9 w-48" order={2} />
        <SuggestionListSkeleton firstOrder={3} />
      </div>
    </SkeletonRegion>
  );
}
