import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { DecodedSpecId } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';

/** Reads a pasted code on the server. Nothing is saved, so nothing is invalidated. */
export function useDecodeSpecId() {
  const gateway = useAtlasGateway();
  return useMutation<DecodedSpecId, AppError, string>({
    mutationFn: (code) => gateway.decode(code),
  });
}
