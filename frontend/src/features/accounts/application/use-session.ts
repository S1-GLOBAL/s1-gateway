import { useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Account } from '../domain/account';
import { markSessionKnown } from '../domain/session-presence';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';
import { retryUnlessSignedOut } from './session-errors';

/**
 * The same account as `useMe`, without suspending: the auth gate needs to
 * tell "signed out" from "failed to load" and send each somewhere different.
 */
export function useSession() {
  const gateway = useAccountsGateway();
  return useQuery<Account, AppError>({
    queryKey: accountsKeys.me(),
    queryFn: async () => {
      const account = await gateway.me();
      markSessionKnown();
      return account;
    },
    staleTime: 30_000,
    retry: retryUnlessSignedOut,
  });
}
