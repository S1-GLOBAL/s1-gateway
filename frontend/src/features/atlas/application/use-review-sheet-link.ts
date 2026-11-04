import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { ReviewSheetLink, ReviewSheetSync } from '../domain/review-sheet';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/** How often the sync's status is asked again: soon while a sync waits or runs, then each minute. */
const SOON = 10_000;
const EACH_MINUTE = 60_000;

/**
 * Where the shared review sheet is, and how its sync stands (plan 0016). The
 * address does not change; the status is asked again while Atlas keeps the
 * sheet, sooner while a sync waits or runs.
 */
export function useReviewSheetLink() {
  const gateway = useAtlasGateway();
  return useQuery<ReviewSheetLink, AppError>({
    queryKey: atlasKeys.reviewSheetLink(),
    queryFn: () => gateway.reviewSheetLink(),
    refetchInterval: (query) => {
      const sync = query.state.data?.sync ?? null;
      if (sync === null) return false;
      return sync.state === 'idle' ? EACH_MINUTE : SOON;
    },
  });
}

/** An admin's Sync now (plan 0016): the status it answers replaces the one shown. */
export function useSyncReviewSheet() {
  const gateway = useAtlasGateway();
  const queryClient = useQueryClient();
  return useMutation<ReviewSheetSync, AppError, void>({
    mutationFn: () => gateway.syncReviewSheet(),
    onSuccess: (sync) => {
      queryClient.setQueryData<ReviewSheetLink>(atlasKeys.reviewSheetLink(), (link) => (link === undefined ? link : { ...link, sync }));
    },
  });
}
