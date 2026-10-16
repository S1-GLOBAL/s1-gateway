export const atlasKeys = {
  all: ['atlas'] as const,
  dictionary: () => [...atlasKeys.all, 'dictionary'] as const,
};
