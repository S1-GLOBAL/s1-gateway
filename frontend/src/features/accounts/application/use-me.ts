import { useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Account } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';
import { retryUnlessSignedOut } from './session-errors';

/** Suspends until the signed-in account arrives (or throws AppError on 401). */
export function useMe() {
  const gateway = useAccountsGateway();
  return useSuspenseQuery<Account, AppError>({
    queryKey: accountsKeys.me(),
    queryFn: () => gateway.me(),
    staleTime: 30_000,
    retry: retryUnlessSignedOut,
  });
}