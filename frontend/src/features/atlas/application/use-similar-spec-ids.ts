import { useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SimilarCriteria, SimilarSpecIds } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * The saved Spec IDs that fit the slots chosen, and those that might. With no
 * slot chosen, all of them. A refused lookup is not asked again: its messages
 * belong beside the controls.
 */
export function useSimilarSpecIds(criteria: SimilarCriteria) {
  const gateway = useAtlasGateway();
  return useQuery<SimilarSpecIds, AppError>({
    queryKey: atlasKeys.similar(criteria),
    queryFn: () => gateway.findSimilar(criteria),
    retry: false,
  });
}
