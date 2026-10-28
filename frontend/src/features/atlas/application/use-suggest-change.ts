import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Suggestion, SuggestionInput } from '../domain/suggestion';
import { atlasKeys } from './atlas.keys';
import { useSuggestionsGateway } from './suggestions-gateway-context';

/**
 * Suggests a change to the dictionary (#95). Nothing in the dictionary changes
 * until an admin approves it, so only the suggestions are asked for again:
 * the lists, each one in full, and the admins' waiting count.
 */
export function useSuggestChange() {
  const gateway = useSuggestionsGateway();
  const queryClient = useQueryClient();
  return useMutation<Suggestion, AppError, SuggestionInput>({
    mutationFn: (input) => gateway.suggest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.suggestions() }),
  });
}

/** The suggester edits their waiting suggestion, from the version they read. Only the suggestions change. */
export function useEditSuggestion() {
  const gateway = useSuggestionsGateway();
  const queryClient = useQueryClient();
  return useMutation<Suggestion, AppError, { id: string; version: number; input: SuggestionInput }>({
    mutationFn: ({ id, version, input }) => gateway.edit(id, { ...input, version }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.suggestions() }),
  });
}
