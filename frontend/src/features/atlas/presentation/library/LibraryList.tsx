import { Package } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Pagination } from '@/shared/ui/Pagination';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import type { useSpecIdLibrary } from '../../application/use-spec-id-library';
import { lowerFirst } from '../../domain/lower-first';
import { NewSpecIdLink } from './NewSpecIdLink';
import { SpecIdCard } from './SpecIdCard';

/** When no saved name matches the search: Search reads the facts instead. */
export const NO_NAMES_MATCH = 'No names match. Press Search to read the facts from your text.';

export interface LibraryListProps {
  library: ReturnType<typeof useSpecIdLibrary>;
  /** The search text asked for, trimmed. */
  q: string;
  /** The product type chosen, in words; undefined for every type. */
  productTypeName: string | undefined;
  /** The page asked for, starting at 1. */
  page: number;
  onPageChange(page: number): void;
  timeZone?: string;
}

/**
 * The saved Spec IDs, one page at a time, each a card that opens it. The
 * numbered pages underneath know how many there are. Says plainly when there
 * are none at all, none of the type chosen, or none matching the search.
 */
export function LibraryList({ library, q, productTypeName, page, onPageChange, timeZone }: LibraryListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const seenPage = useRef<number | undefined>(undefined);
  const shownPage = library.data?.page;

  useEffect(() => {
    if (shownPage === undefined || seenPage.current === shownPage) return;
    const first = seenPage.current === undefined;
    seenPage.current = shownPage;
    if (first) return;
    const list = listRef.current;
    if (!list || typeof list.scrollIntoView !== 'function') return;
    const reduce =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [shownPage]);

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

  const pageData = library.data;
  const items = pageData?.items ?? [];
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

  const pageCount = pageData && pageData.total > 0 ? Math.ceil(pageData.total / pageData.pageSize) : 0;
  const current = pageData?.page ?? page;

  return (
    <div className="flex flex-col gap-4">
      <ul ref={listRef} className="flex scroll-mt-16 flex-col gap-3">
        {items.map((saved) => (
          <li key={saved.id}>
            <SpecIdCard saved={saved} timeZone={timeZone} />
          </li>
        ))}
      </ul>
      {library.isError && (
        <ErrorState message={library.error.message} onRetry={() => void library.refetch()} />
      )}
      <Pagination
        label="Spec ID pages"
        page={current}
        pageCount={pageCount}
        pendingPage={library.isFetching && page !== current ? page : undefined}
        onPageChange={onPageChange}
        className="self-center"
      />
    </div>
  );
}
