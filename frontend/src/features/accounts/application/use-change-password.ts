import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';

export function useChangePassword() {
  const gateway = useAccountsGateway();
  const queryClient = useQueryClient();
  return useMutation<void, AppError, { currentPassword: string; newPassword: string }>({
    mutationFn: (input) => gateway.changePassword(input),
    // Returned, so the caller moves on only once `me` no longer says "must change".
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.me() }),
  });
}