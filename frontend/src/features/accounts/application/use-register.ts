import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Account, Registration } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';

/** Creates the account; the caller sends the person to sign in. */
export function useRegister() {
  const gateway = useAccountsGateway();
  return useMutation<Account, AppError, Registration>({
    mutationFn: (input) => gateway.register(input),
  });
}
