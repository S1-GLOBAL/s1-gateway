import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Account } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';

export function useSignUp() {
  const gateway = useAccountsGateway();
  return useMutation<Account, AppError, { email: string; fullName: string; password: string }>({
    mutationFn: (input) => gateway.signUp(input),
  });
}