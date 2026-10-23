import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { AdminStage, SpecIdManufacturer } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * Admins only: sets a manufacturer's stage on a Spec ID, or clears it with
 * `null` (#57). The Spec ID's manufacturers are asked for again on success,
 * so the manufacturer moves to its new group.
 */
export function useSetManufacturerStage(specId: string) {
  const gateway = useAtlasGateway();
  const queryClient = useQueryClient();
  return useMutation<SpecIdManufacturer, AppError, { manufacturerId: string; stage: AdminStage | null }>({
    mutationFn: ({ manufacturerId, stage }) => gateway.setManufacturerStage(specId, manufacturerId, stage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.manufacturers(specId) }),
  });
}
