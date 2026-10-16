import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SavedSpecId, SpecIdFacts } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/** Saves the Spec ID built from the facts. A saved Spec ID changes what a lookup finds, so lookups are asked again. */
export function useSaveSpecId() {
  const gateway = useAtlasGateway();
  const queryClient = useQueryClient();
  return useMutation<SavedSpecId, AppError, { name: string; facts: SpecIdFacts }>({
    mutationFn: (input) => gateway.save(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.all }),
  });
}
