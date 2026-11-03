import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { ReviewSheet } from './atlas-gateway';
import { useAtlasGateway } from './atlas-gateway-context';

/** Asks for the review workbook (plan 0014). Nothing is kept: each press makes it again from the library as it stands. */
export function useReviewSheet() {
  const gateway = useAtlasGateway();
  return useMutation<ReviewSheet, AppError, void>({
    mutationFn: () => gateway.reviewSheet(),
  });
}
