import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SimilarCriteria, SimilarSpecIds } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * The saved Spec IDs that fit the slots chosen, and those that might. With no
 * slot chosen, all of them. A refused lookup is not asked again: its messages
 * belong beside the controls. With `keepPrevious`, the last answer stays while
 * the next criteria are looked up, as Search's do while text is typed; with
 * `enabled` false, nothing is asked.
 */
export function useSimilarSpecIds(criteria: SimilarCriteria, options: { keepPrevious?: boolean; enabled?: boolean } = {}) {
  const gateway = useAtlasGateway();
  return useQuery<SimilarSpecIds, AppError>({
    queryKey: atlasKeys.similar(criteria),
    queryFn: () => gateway.findSimilar(criteria),
    ...(options.keepPrevious ? { placeholderData: keepPreviousData } : {}),
    enabled: options.enabled ?? true,
    retry: false,
  });
}
