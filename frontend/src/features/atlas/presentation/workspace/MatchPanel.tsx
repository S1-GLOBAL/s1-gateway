import { ArrowRight, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSimilarSpecIds } from '../../application/use-similar-spec-ids';
import type { DecodedSpecId, SavedSpecId } from '../../domain/atlas';
import { formatSavedDate } from '../../domain/format-saved-date';
import { knownCriteria } from '../../domain/known-criteria';

export interface MatchPanelProps {
  /** The code the facts build now. */
  decoded: DecodedSpecId | undefined;
  /** Another saved Spec ID with exactly this code, or null. */
  match: SavedSpecId | null;
  /** The Spec ID being changed: never its own match, never similar to itself. */
  ownId?: string;
  timeZone?: string;
}

/**
 * Whether the product is already saved: an exact match, highlighted, with the
 * way to it; and the saved Spec IDs whose known facts are alike, folded away
 * and never highlighted.
 */
export function MatchPanel({ decoded, match, ownId, timeZone }: MatchPanelProps) {
  return (
    <>
      {match && (
        <section
          aria-label="Already saved"
          className="flex flex-col gap-1 rounded-surface border border-border bg-accent-soft p-5"
        >
          <p className="text-xs font-medium text-accent-ink">Already saved</p>
          <p className="text-md font-medium break-words text-ink">{match.name}</p>
          <p className="text-sm text-ink-muted">
            {`Same code · saved by ${match.savedBy.fullName} on ${formatSavedDate(match.savedAt, timeZone)}`}
          </p>
          <Link
            to={`/atlas/${match.id}`}
            className="mt-2 inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-ink underline-offset-4 hover:underline"
          >
            Open and update it
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </section>
      )}
      {decoded && <SimilarList decoded={decoded} exclude={[ownId, match?.id]} />}
    </>
  );
}

/** Saved Spec IDs that fit, or might fit, the known facts. Nothing at all while there are none. */
function SimilarList({ decoded, exclude }: { decoded: DecodedSpecId; exclude: readonly (string | undefined)[] }) {
  const similar = useSimilarSpecIds(knownCriteria(decoded));
  const { fits = [], mightFit = [] } = similar.data ?? {};
  const seen = new Set<string>();
  const items = [...fits, ...mightFit].filter((saved) => {
    if (seen.has(saved.id) || exclude.includes(saved.id) || saved.code === decoded.code) return false;
    seen.add(saved.id);
    return true;
  });
  if (items.length === 0) return null;

  return (
    <details className="group rounded-surface border border-border bg-surface shadow-sm">
      <summary className="flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden justify-between gap-3 rounded-surface px-5 py-4 text-sm font-medium text-ink">
        {`${items.length} similar ${items.length === 1 ? 'Spec ID' : 'Spec IDs'}`}
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="text-ink-muted transition-transform duration-150 ease-standard group-open:rotate-180"
        />
      </summary>
      <ul className="flex flex-col border-t border-border">
        {items.map((saved) => (
          <li key={saved.id} className="border-b border-border last:border-b-0">
            <Link
              to={`/atlas/${saved.id}`}
              className="flex flex-col gap-0.5 px-5 py-3 transition-colors duration-150 ease-standard hover:bg-surface-raised"
            >
              <span className="text-sm break-words text-ink">{saved.name}</span>
              <span className="font-mono text-xs break-all text-ink-muted">{saved.code}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
