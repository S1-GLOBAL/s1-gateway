import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SpecIdTextReading } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';

/**
 * Reads the facts in raw text on the server, as a product type when one is
 * given. Nothing is saved, so nothing is asked again afterwards.
 */
export function useReadText() {
  const gateway = useAtlasGateway();
  return useMutation<SpecIdTextReading, AppError, { text: string; productType?: string }>({
    mutationFn: (input) => gateway.readText(input),
  });
}
