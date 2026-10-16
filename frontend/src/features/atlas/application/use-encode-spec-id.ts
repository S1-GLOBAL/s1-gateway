import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { DecodedSpecId, SpecIdFacts } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * The code for the facts, built on the server whenever they change. The last
 * code stays on screen while the next one is asked for. Nothing is saved, and a
 * refused set of facts is not asked again: its messages belong beside the controls.
 */
export function useEncodeSpecId(facts: SpecIdFacts) {
  const gateway = useAtlasGateway();
  return useQuery<DecodedSpecId, AppError>({
    queryKey: atlasKeys.encode(facts),
    queryFn: () => gateway.encode(facts),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
