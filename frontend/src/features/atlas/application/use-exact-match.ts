import { useQuery } from '@tanstack/react-query';
import { AppError } from '@/shared/application/app-error';
import type { SavedSpecId } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * The saved Spec ID that has `code` now, or null. A Spec ID that only once had
 * the code is no match: a code corrected away is free (ADR 0022). With no code
 * yet, nothing is asked.
 */
export function useExactMatch(code: string | undefined) {
  const gateway = useAtlasGateway();
  return useQuery<SavedSpecId | null, AppError>({
    queryKey: atlasKeys.exact(code ?? ''),
    queryFn: async () => {
      try {
        const lookup = await gateway.findByCode(code ?? '');
        return lookup.replacedCode === null ? lookup : null;
      } catch (error) {
        if (error instanceof AppError && error.code === 'SPEC_ID_NOT_FOUND') return null;
        throw error;
      }
    },
    enabled: code !== undefined,
    retry: false,
  });
}
