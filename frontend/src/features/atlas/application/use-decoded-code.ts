import { useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { DecodedSpecId } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * A code read slot by slot, to start a new Spec ID from it (`/atlas/new?code=`).
 * Suspends while it is read, so the route's skeleton covers it. Null with no
 * code, and for a code that cannot be read: the form then starts empty.
 */
export function useDecodedCode(code: string | null) {
  const gateway = useAtlasGateway();
  return useSuspenseQuery<DecodedSpecId | null, AppError>({
    queryKey: atlasKeys.decode(code ?? ''),
    queryFn: async () => {
      if (code === null) return null;
      try {
        return await gateway.decode(code);
      } catch {
        return null;
      }
    },
  });
}
