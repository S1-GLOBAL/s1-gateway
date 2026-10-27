import type { SimilarCriteria, SpecIdFacts } from '../domain/atlas';

export const atlasKeys = {
  all: ['atlas'] as const,
  dictionary: () => [...atlasKeys.all, 'dictionary'] as const,
  encode: (facts: SpecIdFacts) => [...atlasKeys.all, 'encode', facts] as const,
  similar: (criteria: SimilarCriteria) => [...atlasKeys.all, 'similar', criteria] as const,
  decode: (code: string) => [...atlasKeys.all, 'decode', code] as const,
  exact: (code: string) => [...atlasKeys.all, 'exact', code] as const,
  saved: (id: string) => [...atlasKeys.all, 'saved', id] as const,
  history: (id: string) => [...atlasKeys.all, 'history', id] as const,
  manufacturers: (id: string) => [...atlasKeys.all, 'manufacturers', id] as const,
  library: (request: { q: string; productType: string; page: number }) => [...atlasKeys.all, 'library', request] as const,
  code: (code: string) => [...atlasKeys.all, 'code', code] as const,
  suggestions: () => [...atlasKeys.all, 'suggestions'] as const,
  suggestionList: (state: 'waiting' | 'decided') => [...atlasKeys.suggestions(), 'list', state] as const,
  suggestion: (id: string) => [...atlasKeys.suggestions(), 'one', id] as const,
  waitingCount: () => [...atlasKeys.suggestions(), 'waiting-count'] as const,
};
