import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { useSimilarSpecIds } from '../../application/use-similar-spec-ids';
import type { DecodedSpecId } from '../../domain/atlas';
import { factsCriteria, factsOf, withSameFacts } from '../../domain/same-facts';
import { SpecIdGroup } from './SpecIdGroup';

/** The group's title, before the facts it names. */
export const SAME_FACTS = 'Same product, other sizes';

/** How many are shown before Show all. */
const SHOWN = 10;

export interface SameFactsGroupProps {
  /** The code Search found or read. */
  decoded: DecodedSpecId;
  /** The match shown above: not listed again. */
  leaveOut?: string;
  timeZone?: string;
}

/**
 * Every saved Spec ID with exactly the facts of the code, the part before the
 * hyphen, at any size or none: the same product in its other sizes, grouped
 * as the review sheet's Spec IDs tab groups them, in code order. Shown only
 * when there is one; the first ten, then Show all.
 */
export function SameFactsGroup({ decoded, leaveOut, timeZone }: SameFactsGroupProps) {
  const similar = useSimilarSpecIds(factsCriteria(decoded), { keepPrevious: true });
  const [showAll, setShowAll] = useState(false);
  // The groups below show their own skeleton while Search looks.
  if (similar.isPending) return null;
  if (similar.isError) return <ErrorState message={similar.error.message} onRetry={() => void similar.refetch()} />;

  const family = withSameFacts(decoded.code, similar.data.fits).filter((saved) => saved.id !== leaveOut);
  if (family.length === 0) return null;
  const shown = showAll ? family : family.slice(0, SHOWN);
  return (
    <div className="flex flex-col gap-3">
      <SpecIdGroup title={`${SAME_FACTS} — ${factsOf(decoded.code)}`} items={shown} timeZone={timeZone} />
      {shown.length < family.length && (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setShowAll(true)}>
          {`Show all ${family.length}`}
        </Button>
      )}
    </div>
  );
}
