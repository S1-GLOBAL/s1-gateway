import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SavedSpecId, SpecIdFacts } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * Changes a saved Spec ID. The answer is the Spec ID as now saved; its history
 * and every lookup are asked again, since its code may have changed — behind
 * the answer, so Save changes is done as soon as the save is.
 */
export function useUpdateSpecId(id: string) {
  const gateway = useAtlasGateway();
  const queryClient = useQueryClient();
  return useMutation<SavedSpecId, AppError, { name: string; facts: SpecIdFacts; version: number }>({
    mutationFn: (input) => gateway.update(id, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(atlasKeys.saved(id), saved);
      void queryClient.invalidateQueries({
        queryKey: atlasKeys.all,
        predicate: (query) => query.queryKey[1] !== 'saved' && query.queryKey[1] !== 'dictionary',
      });
    },
  });
}
