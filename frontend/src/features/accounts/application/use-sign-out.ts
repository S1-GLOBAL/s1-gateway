import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import { clearSessionKnown } from '../domain/session-presence';
import { accountsKeys } from './accounts.keys';
import { useAccountsGateway } from './accounts-gateway-context';

/**
 * Ends the session and drops the cached account so the next screen (landing
 * or sign-in) does not still treat us as signed in.
 */
export function useSignOut() {
  const gateway = useAccountsGateway();
  const queryClient = useQueryClient();
  return useMutation<void, AppError, void>({
    mutationFn: async () => {
      await gateway.signOut();
      clearSessionKnown();
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: accountsKeys.me() });
    },
  });
}
