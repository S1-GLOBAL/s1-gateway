import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import { clearSessionKnown } from '../domain/session-presence';
import { useAccountsGateway } from './accounts-gateway-context';

/**
 * Ends the session. The cache is cleared by the next sign-in, not here:
 * clearing while the shell is still mounted would make it fetch `me` again.
 */
export function useSignOut() {
  const gateway = useAccountsGateway();
  return useMutation<void, AppError, void>({
    mutationFn: async () => {
      await gateway.signOut();
      clearSessionKnown();
    },
  });
}
