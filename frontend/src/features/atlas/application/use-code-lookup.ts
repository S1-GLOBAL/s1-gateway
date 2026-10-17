import { useQuery } from '@tanstack/react-query';
import { AppError } from '@/shared/application/app-error';
import type { DecodedSpecId, SpecIdLookup } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';

/** What a pasted code turned out to be. */
export type CodeLookup =
  /** A saved Spec ID has it now, or had it last (`replacedCode`). */
  | { kind: 'saved'; lookup: SpecIdLookup }
  /** A valid code no Spec ID has or had. */
  | { kind: 'unsaved'; decoded: DecodedSpecId }
  /** Not a valid code: the decoder's messages, by slot and for the whole code. */
  | { kind: 'invalid'; fields: Record<string, string[]> };

/**
 * A pasted code, looked up: the saved Spec ID it belongs to, or else the code
 * read slot by slot, or else why it cannot be read. With no code, nothing is asked.
 */
export function useCodeLookup(code: string | null) {
  const gateway = useAtlasGateway();
  return useQuery<CodeLookup, AppError>({
    queryKey: atlasKeys.code(code ?? ''),
    queryFn: async () => {
      const value = code ?? '';
      try {
        return { kind: 'saved', lookup: await gateway.findByCode(value) };
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== 'SPEC_ID_NOT_FOUND') throw error;
      }
      try {
        return { kind: 'unsaved', decoded: await gateway.decode(value) };
      } catch (error) {
        if (error instanceof AppError && error.code === 'INVALID_SPEC_ID') return { kind: 'invalid', fields: error.fields };
        throw error;
      }
    },
    enabled: code !== null,
    retry: false,
  });
}
