import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SpecIdTextReading } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/** Text to read, and a product type to read it as when the text names none. */
export interface TextToRead {
  text: string;
  productType?: string;
}

/**
 * Reads the facts in raw text on the server as it is typed, as a product type
 * when one is given; null asks nothing. While the next text is read, the last
 * reading stays on screen, so the code does not flicker away between
 * keystrokes, and a request for text since changed is stopped. Nothing is
 * saved.
 */
export function useReadText(input: TextToRead | null) {
  const gateway = useAtlasGateway();
  return useQuery<SpecIdTextReading, AppError>({
    queryKey: atlasKeys.reading(input?.text ?? '', input?.productType ?? ''),
    queryFn: ({ signal }) => gateway.readText(input ?? { text: '' }, signal),
    enabled: input !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
