import { useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { AtlasDictionary } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/**
 * Suspends until the dictionary arrives, so the route's skeleton covers both
 * the page's code and its data (ADR 0013). A failure is thrown to the nearest
 * error boundary.
 */
export function useDictionary() {
  const gateway = useAtlasGateway();
  return useSuspenseQuery<AtlasDictionary, AppError>({
    queryKey: atlasKeys.dictionary(),
    queryFn: () => gateway.dictionary(),
  });
}
