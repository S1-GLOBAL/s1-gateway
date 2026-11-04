import { useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/** Where the shared review sheet is (plan 0016): a Google Sheet's address, or null when none is set. */
export function useReviewSheetLink() {
  const gateway = useAtlasGateway();
  return useQuery<string | null, AppError>({
    queryKey: atlasKeys.reviewSheetLink(),
    queryFn: () => gateway.reviewSheetLink(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
