import { useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { AccountInvite } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';

/** Admin only: the unused invites, newest first. Suspends, like the account lists (ADR 0013). */
export function useInvites() {
  const gateway = useAccountsGateway();
  return useSuspenseQuery<AccountInvite[], AppError>({
    queryKey: accountsKeys.invites(),
    queryFn: () => gateway.listInvites(),
  });
}
