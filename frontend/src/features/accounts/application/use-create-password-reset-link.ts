import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { PasswordResetLink } from '../domain/account';
import { useAccountsGateway } from './accounts-gateway-context';

/** The link is shown once by the caller; it is never cached. */
export function useCreatePasswordResetLink() {
  const gateway = useAccountsGateway();
  return useMutation<PasswordResetLink, AppError, string>({
    mutationFn: (id) => gateway.createPasswordResetLink(id),
  });
}