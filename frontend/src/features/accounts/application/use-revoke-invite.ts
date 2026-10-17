import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { AccountInvite } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';

export function useRevokeInvite() {
  const gateway = useAccountsGateway();
  const queryClient = useQueryClient();
  return useMutation<AccountInvite, AppError, string>({
    mutationFn: (id) => gateway.revokeInvite(id),
    // Refetched on failure too: an invite used or revoked meanwhile leaves the list.
    onSettled: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}
