import { keepPreviousData, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SpecIdLibraryPage } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

type LibraryFilter = { q: string; productType: string };

/**
 * The library, 20 Spec IDs a page, newest change first: those whose name has
 * `q`, of `productType` when one is chosen (`''` for every type). The list
 * shown stays while the next search is asked for. Asked for only while
 * `enabled`; a refused search is not asked again: its message belongs beside the box.
 */
export function useSpecIdLibrary(filter: LibraryFilter, enabled: boolean) {
  const gateway = useAtlasGateway();
  return useInfiniteQuery<
    SpecIdLibraryPage,
    AppError,
    InfiniteData<SpecIdLibraryPage, string | undefined>,
    ReturnType<typeof atlasKeys.library>,
    string | undefined
  >({
    queryKey: atlasKeys.library(filter),
    queryFn: ({ pageParam }) => gateway.library({ q: filter.q, productType: filter.productType, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    retry: false,
    enabled,
  });
}
