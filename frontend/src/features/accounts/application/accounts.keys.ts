export const accountsKeys = {
  all: ['accounts'] as const,
  me: () => [...accountsKeys.all, 'me'] as const,
  list: () => [...accountsKeys.all, 'list'] as const,
};
