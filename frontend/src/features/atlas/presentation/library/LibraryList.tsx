import { Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import type { useSpecIdLibrary } from '../../application/use-spec-id-library';
import { lowerFirst } from '../../domain/lower-first';
import { NewSpecIdLink } from './NewSpecIdLink';
import { SpecIdSummary } from './SpecIdSummary';

/** When no saved name matches the search: Search reads the facts instead. */
export const NO_NAMES_MATCH = 'No names match. Press Search to read the facts from your text.';

export interface LibraryListProps {
  library: ReturnType<typeof useSpecIdLibrary>;
  /** The search text asked for, trimmed. */
  q: string;
  /** The product type chosen, in words; undefined for every type. */
  productTypeName: string | undefined;
  timeZone?: string;
}

/**
 * The saved Spec IDs, 20 at a time, each a card that opens it. Says plainly
 * when there are none at all, none of the type chosen, or none matching the search.
 */
export function LibraryList({ library, q, productTypeName, timeZone }: LibraryListProps) {
  if (library.isPending) {
    return (
      <SkeletonRegion label="Spec IDs" className="flex flex-col gap-3">
        {[0, 1, 2].map((card) => (
          <SkeletonBlock key={card} className="h-32 w-full rounded-surface" order={card} />
        ))}
      </SkeletonRegion>
    );
  }
  if (library.isError && !library.data) {
    // A refused search's message is already beside the box.
    if (library.error.code === 'VALIDATION_FAILED') return null;
    return <ErrorState message={library.error.message} onRetry={() => void library.refetch()} />;
  }

  const items = library.data?.pages.flatMap((page) => page.items) ?? [];
  if (items.length === 0) {
    // The last search's empty answer, kept while this one is asked: it says nothing about this one yet.
    if (library.isPlaceholderData) return null;
    if (q !== '') {
      return (
        <p role="status" className="text-sm text-ink-muted">
          {NO_NAMES_MATCH}
        </p>
      );
    }
    if (productTypeName) {
      return (
        <p role="status" className="text-sm text-ink-muted">
          {`No ${lowerFirst(productTypeName)} Spec IDs yet.`}
        </p>
      );
    }
    return (
      <EmptyState
        icon={<Package size={24} strokeWidth={1.75} aria-hidden="true" />}
        title="No Spec IDs yet"
        description="Describe a product to give it its first code."
        action={<NewSpecIdLink />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((saved) => (
          <li key={saved.id}>
            <Link
              to={`/atlas/${saved.id}`}
              className="block rounded-surface border border-border bg-surface p-5 shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised"
            >
              <SpecIdSummary saved={saved} timeZone={timeZone} />
            </Link>
          </li>
        ))}
      </ul>
      {library.isFetchNextPageError && (
        <ErrorState message={library.error?.message ?? ''} onRetry={() => void library.fetchNextPage()} />
      )}
      {library.hasNextPage && !library.isFetchNextPageError && (
        <Button
          variant="secondary"
          loading={library.isFetchingNextPage}
          onClick={() => void library.fetchNextPage()}
          className="self-center"
        >
          Show more
        </Button>
      )}
    </div>
  );
}
