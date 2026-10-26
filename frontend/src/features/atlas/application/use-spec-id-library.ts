import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SpecIdLibraryPage } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

type LibraryRequest = { q: string; productType: string; page: number };

/**
 * One page of the library, newest change first: those whose name has `q`, of
 * `productType` when one is chosen (`''` for every type). `page` starts at 1.
 * The list shown stays while the next page or search is asked for. Asked for
 * only while `enabled`; a refused search is not asked again: its message
 * belongs beside the box.
 */
export function useSpecIdLibrary(request: LibraryRequest, enabled: boolean) {
  const gateway = useAtlasGateway();
  return useQuery<SpecIdLibraryPage, AppError>({
    queryKey: atlasKeys.library(request),
    queryFn: () => gateway.library({ q: request.q, productType: request.productType, page: request.page }),
    placeholderData: keepPreviousData,
    retry: false,
    enabled,
  });
}
