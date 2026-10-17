import { useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { InviteDetails } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';
import { isInviteInvalid } from './invite-errors';

/**
 * The invite behind a registration link. It does not suspend: the page must
 * tell "this link no longer works" from "failed to load" and show each its own way.
 */
export function useInvite(token: string) {
  const gateway = useAccountsGateway();
  return useQuery<InviteDetails, AppError>({
    queryKey: accountsKeys.invite(token),
    queryFn: () => gateway.getInvite(token),
    // A link that no longer works will not start working; anything else gets one more try.
    retry: (failureCount, error) => !isInviteInvalid(error) && failureCount < 1,
  });
}
