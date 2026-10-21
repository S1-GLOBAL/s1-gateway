import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import { useSimilarSpecIds } from '../../application/use-similar-spec-ids';
import type { DecodedSpecId, SavedSpecId, SlotRuleEntry } from '../../domain/atlas';
import { knownCriteria } from '../../domain/known-criteria';
import { SaveFromSearch } from './SaveFromSearch';
import { SpecIdSummary } from './SpecIdSummary';

const LINK =
  'inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-ink underline-offset-4 hover:underline';

export interface TextSearchResultsProps {
  /** The code the text's facts make. */
  decoded: DecodedSpecId;
  /** The text Search read, trimmed. */
  text: string;
  rules: readonly SlotRuleEntry[];
  timeZone?: string;
}

/**
 * The saved Spec IDs that fit every fact read, then those that might: nothing
 * contradicts them, but some facts aren't recorded. When none fits, the way to
 * start a Spec ID from the code, and to save it at once, come before those
 * that might. Nothing is saved until Save as a new Spec ID is pressed.
 */
export function TextSearchResults({ decoded, text, rules, timeZone }: TextSearchResultsProps) {
  const similar = useSimilarSpecIds(knownCriteria(decoded));

  if (similar.isPending) {
    return (
      <SkeletonRegion label="Spec IDs" className="flex flex-col gap-3">
        {[0, 1, 2].map((card) => (
          <SkeletonBlock key={card} className="h-32 w-full rounded-surface" order={card} />
        ))}
      </SkeletonRegion>
    );
  }
  if (similar.isError) return <ErrorState message={similar.error.message} onRetry={() => void similar.refetch()} />;

  const { fits, mightFit } = similar.data;
  return (
    <div className="flex flex-col gap-6">
      {fits.length > 0 ? (
        <Group title="Fits — every fact you gave matches" items={fits} timeZone={timeZone} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p role="status" className="text-sm text-ink-muted">
              No saved Spec ID fits these facts.
            </p>
            <Link to={`/atlas/new?code=${encodeURIComponent(decoded.code)}`} className={LINK}>
              Start a Spec ID from it
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
          <SaveFromSearch decoded={decoded} text={text} rules={rules} timeZone={timeZone} />
        </div>
      )}
      {mightFit.length > 0 && (
        <Group
          title="Might fit — nothing contradicts, but some facts aren't recorded"
          items={mightFit}
          timeZone={timeZone}
        />
      )}
    </div>
  );
}

function Group({ title, items, timeZone }: { title: string; items: SavedSpecId[]; timeZone?: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((saved) => (
          <li key={saved.id}>
            <Link
              to={`/atlas/${saved.id}`}
              className="block rounded-surface border border-border bg-surface p-5 shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised"
            >
              <SpecIdSummary saved={saved} timeZone={timeZone} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
