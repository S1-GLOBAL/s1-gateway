import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Account } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';

export function useSignIn() {
  const gateway = useAccountsGateway();
  const queryClient = useQueryClient();
  return useMutation<Account, AppError, { email: string; password: string }>({
    mutationFn: (input) => gateway.signIn(input),
    // Whatever the last person on this device had cached is not for this one.
    onSuccess: () => queryClient.clear(),
  });
}