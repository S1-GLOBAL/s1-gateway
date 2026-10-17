import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { CreatedInvite } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';

/** The link is shown once by the caller and never cached; the Invited list refetches. */
export function useCreateInvite() {
  const gateway = useAccountsGateway();
  const queryClient = useQueryClient();
  return useMutation<CreatedInvite, AppError, string>({
    mutationFn: (email) => gateway.createInvite(email),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}
