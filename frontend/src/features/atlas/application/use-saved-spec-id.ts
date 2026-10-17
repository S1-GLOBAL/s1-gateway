import { useSuspenseQuery } from '@tanstack/react-query';
import { AppError } from '@/shared/application/app-error';
import type { SavedSpecId } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * Suspends until the saved Spec ID arrives, so the route's skeleton covers it
 * (ADR 0013). Null when no Spec ID has this id, or the id is not one: the page
 * says so. Any other failure is thrown to the route's error boundary.
 */
export function useSavedSpecId(id: string) {
  const gateway = useAtlasGateway();
  return useSuspenseQuery<SavedSpecId | null, AppError>({
    queryKey: atlasKeys.saved(id),
    queryFn: async () => {
      try {
        return await gateway.getSaved(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'SPEC_ID_NOT_FOUND') return null;
        throw error;
      }
    },
  });
}
