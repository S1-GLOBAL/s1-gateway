import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { ApprovedChange, Suggestion } from '../domain/suggestion';
import { atlasKeys } from './atlas.keys';
import { useSuggestionsGateway } from './suggestions-gateway-context';

/**
 * Admins only: approves the version the approver read (#95). An approval
 * changes the dictionary and may rewrite saved Spec IDs, so everything Atlas
 * holds is asked for again.
 */
export function useApproveSuggestion() {
  const gateway = useSuggestionsGateway();
  const queryClient = useQueryClient();
  return useMutation<ApprovedChange, AppError, { id: string; version: number }>({
    mutationFn: ({ id, version }) => gateway.approve(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.all }),
  });
}

/** Admins only: rejects with a reason the suggester sees. Only the suggestions change. */
export function useRejectSuggestion() {
  const gateway = useSuggestionsGateway();
  const queryClient = useQueryClient();
  return useMutation<Suggestion, AppError, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => gateway.reject(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.suggestions() }),
  });
}

/** The suggester takes back a waiting suggestion. Only the suggestions change. */
export function useWithdrawSuggestion() {
  const gateway = useSuggestionsGateway();
  const queryClient = useQueryClient();
  return useMutation<Suggestion, AppError, { id: string }>({
    mutationFn: ({ id }) => gateway.withdraw(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.suggestions() }),
  });
}
