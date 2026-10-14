export const toolsKeys = {
  all: ['tools'] as const,
  list: () => [...toolsKeys.all, 'list'] as const,
};
