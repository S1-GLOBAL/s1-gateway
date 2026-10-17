import { useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SpecIdChange } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/** A saved Spec ID's history, newest first. Asked for only while `enabled`: the History panel is open. */
export function useSpecIdHistory(id: string, enabled: boolean) {
  const gateway = useAtlasGateway();
  return useQuery<SpecIdChange[], AppError>({
    queryKey: atlasKeys.history(id),
    queryFn: () => gateway.history(id),
    enabled,
  });
}
