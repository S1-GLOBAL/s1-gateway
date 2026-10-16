import { useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { AccountLists } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';

/** Admin only. Suspends so the page's skeleton covers its data (ADR 0013). */
export function useListAccounts() {
  const gateway = useAccountsGateway();
  return useSuspenseQuery<AccountLists, AppError>({
    queryKey: accountsKeys.list(),
    queryFn: () => gateway.listAccounts(),
  });
}