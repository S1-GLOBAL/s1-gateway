import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SlotKey } from '../domain/atlas';
import type { Suggestion, SuggestionDetail } from '../domain/suggestion';
import { atlasKeys } from './atlas.keys';
import { useSuggestionsGateway } from './suggestions-gateway-context';

/** Suspends until one list arrives: waiting oldest first, decided latest decision first (ADR 0013). */
export function useSuggestionList(state: 'waiting' | 'decided') {
  const gateway = useSuggestionsGateway();
  return useSuspenseQuery<Suggestion[], AppError>({
    queryKey: atlasKeys.suggestionList(state),
    queryFn: () => gateway.list(state),
  });
}

/** Suspends until every one of `ids` arrives in full, so the cards appear together. */
export function useSuggestionDetails(ids: readonly string[]) {
  const gateway = useSuggestionsGateway();
  return useSuspenseQueries({
    queries: ids.map((id) => ({
      queryKey: atlasKeys.suggestion(id),
      queryFn: () => gateway.get(id),
    })),
    combine: (results) => results.map((result) => result.data as SuggestionDetail),
  });
}

/** One suggestion in full, asked for only once `enabled`: a decided card's trail, opened. */
export function useSuggestion(id: string, enabled: boolean) {
  const gateway = useSuggestionsGateway();
  return useQuery<SuggestionDetail, AppError>({
    queryKey: atlasKeys.suggestion(id),
    queryFn: () => gateway.get(id),
    enabled,
  });
}

/**
 * How many waiting suggestions the signed-in person may decide, for the
 * sidebar's badge. Asked only for an admin: staff decide none. It never
 * suspends, so the shell draws without it.
 */
export function useWaitingCount(isAdmin: boolean) {
  const gateway = useSuggestionsGateway();
  return useQuery<number, AppError>({
    queryKey: atlasKeys.waitingCount(),
    queryFn: () => gateway.waitingCount(),
    enabled: isAdmin,
    staleTime: 30_000,
  });
}

/** How many saved Spec IDs hold an option, asked for only once `enabled`. An approval asks again. */
export function useDictionaryUsage(slot: SlotKey, code: string, enabled: boolean) {
  const gateway = useSuggestionsGateway();
  return useQuery<number, AppError>({
    queryKey: atlasKeys.usage(slot, code),
    queryFn: () => gateway.usage(slot, code),
    enabled,
  });
}
