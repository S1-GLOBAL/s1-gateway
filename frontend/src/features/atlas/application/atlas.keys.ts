import type { SimilarCriteria, SpecIdFacts } from '../domain/atlas';

export const atlasKeys = {
  all: ['atlas'] as const,
  dictionary: () => [...atlasKeys.all, 'dictionary'] as const,
  encode: (facts: SpecIdFacts) => [...atlasKeys.all, 'encode', facts] as const,
  similar: (criteria: SimilarCriteria) => [...atlasKeys.all, 'similar', criteria] as const,
};
