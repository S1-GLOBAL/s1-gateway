import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Account } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';

export function useDisableAccount() {
  const gateway = useAccountsGateway();
  const queryClient = useQueryClient();
  return useMutation<Account, AppError, string>({
    mutationFn: (id) => gateway.disableAccount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.list() }),
  });
}