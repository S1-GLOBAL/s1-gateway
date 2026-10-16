import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SavedSpecId } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';

/** Opens a saved Spec ID by its exact code, when asked. Nothing changes, so nothing is invalidated. */
export function useFindSpecId() {
  const gateway = useAtlasGateway();
  return useMutation<SavedSpecId, AppError, string>({
    mutationFn: (code) => gateway.findByCode(code),
  });
}
