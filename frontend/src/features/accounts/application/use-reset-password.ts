import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import { useAccountsGateway } from './accounts-gateway-context';

export function useResetPassword() {
  const gateway = useAccountsGateway();
  return useMutation<void, AppError, { token: string; newPassword: string }>({
    mutationFn: (input) => gateway.resetPassword(input),
  });
}