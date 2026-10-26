import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Account, AccountRole } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';

export function useSetAccountRole() {
  const gateway = useAccountsGateway();
  const queryClient = useQueryClient();
  return useMutation<Account, AppError, { id: string; role: AccountRole }>({
    mutationFn: ({ id, role }) => gateway.setAccountRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.list() }),
  });
}
