import { useSuspenseQuery } from '@tanstack/react-query';
import { AppError } from '@/shared/application/app-error';
import type { SpecIdManufacturers } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * Suspends until a saved Spec ID's manufacturers arrive, so the route's
 * skeleton covers them (ADR 0013). Null when no Spec ID has this id, or the id
 * is not one: the page says so. Any other failure is thrown to the route's
 * error boundary.
 */
export function useSpecIdManufacturers(id: string) {
  const gateway = useAtlasGateway();
  return useSuspenseQuery<SpecIdManufacturers | null, AppError>({
    queryKey: atlasKeys.manufacturers(id),
    queryFn: async () => {
      try {
        return await gateway.manufacturers(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'SPEC_ID_NOT_FOUND') return null;
        throw error;
      }
    },
  });
}
