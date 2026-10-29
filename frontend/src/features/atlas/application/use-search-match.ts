import type { DecodedSpecId, SavedSpecId } from '../domain/atlas';
import { knownCriteria } from '../domain/known-criteria';
import { useExactMatch } from './use-exact-match';
import { useSimilarSpecIds } from './use-similar-spec-ids';

/** The one saved Spec ID a search's code answers, and how. */
export interface SearchMatch {
  readonly saved: SavedSpecId;
  /** True when its code is the one read; false when it has every fact read and records more. */
  readonly exact: boolean;
}

/**
 * The saved Spec ID a search's code answers: the one whose code it is, or
 * else the only one that fits every fact read. Several that fit are no single
 * answer, so none is. Undefined until both lookups answer for this code, so
 * a match is never shown for text since changed, nor moves once shown; null
 * with no code.
 */
export function useSearchMatch(decoded: DecodedSpecId | null | undefined): SearchMatch | null | undefined {
  const exact = useExactMatch(decoded?.code);
  const similar = useSimilarSpecIds(decoded ? knownCriteria(decoded) : {}, { keepPrevious: true, enabled: decoded != null });
  if (decoded == null) return null;
  if (exact.data) return { saved: exact.data, exact: true };
  if (exact.isPending || !similar.data || similar.isPlaceholderData) return undefined;
  const [only] = similar.data.fits;
  return similar.data.fits.length === 1 && only !== undefined ? { saved: only, exact: false } : null;
}
