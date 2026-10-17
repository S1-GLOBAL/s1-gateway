export const accountsKeys = {
  all: ['accounts'] as const,
  me: () => [...accountsKeys.all, 'me'] as const,
  list: () => [...accountsKeys.all, 'list'] as const,
  invites: () => [...accountsKeys.all, 'invites'] as const,
  invite: (token: string) => [...accountsKeys.all, 'invite', token] as const,
};
