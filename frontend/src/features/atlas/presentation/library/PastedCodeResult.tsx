import { ArrowRight, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import type { useCodeLookup } from '../../application/use-code-lookup';
import { useSimilarSpecIds } from '../../application/use-similar-spec-ids';
import { SLOT_NAMES, type DecodedSpecId, type FormerHolder, type SpecIdLookup } from '../../domain/atlas';
import { formatSavedDate } from '../../domain/format-saved-date';
import { knownCriteria } from '../../domain/known-criteria';
import { DecodedSlotsTable, type DecodedSlotRow } from '../DecodedSlotsTable';
import { MatchCard } from './MatchCard';
import { hasSameFacts } from '../../domain/same-facts';
import { SameFactsGroup } from './SameFactsGroup';
import { SpecIdGroup } from './SpecIdGroup';
import { SpecIdSummary } from './SpecIdSummary';
import { FITS, MIGHT_FIT } from './TextSearchResults';

const LINK =
  'inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-ink underline-offset-4 hover:underline';

export interface PastedCodeResultProps {
  /** The code pasted, trimmed and upper-cased. */
  code: string;
  result: ReturnType<typeof useCodeLookup>;
  timeZone?: string;
}

/**
 * What a pasted code is: the saved Spec ID that has it, a perfect match as
 * Search shows one, with a note for each that had it before, then the other
 * saved Spec IDs that have every fact it gives, and those that might; the one
 * it became; or, unsaved, its slots in plain words, the way to start a Spec ID
 * from it, and the saved Spec IDs that fit or might; or the decoder's messages.
 */
export function PastedCodeResult({ code, result, timeZone }: PastedCodeResultProps) {
  if (result.isPending) {
    return (
      <SkeletonRegion label="Spec ID">
        <SkeletonBlock className="h-32 w-full rounded-surface" />
      </SkeletonRegion>
    );
  }
  if (result.isError) return <ErrorState message={result.error.message} onRetry={() => void result.refetch()} />;

  const found = result.data;
  if (found.kind === 'saved') {
    return found.lookup.replacedCode === null ? (
      <Matched lookup={found.lookup} timeZone={timeZone} />
    ) : (
      <Replaced lookup={found.lookup} timeZone={timeZone} />
    );
  }
  if (found.kind === 'unsaved') {
    return (
      <div className="flex flex-col gap-6">
        <Unsaved code={code} decoded={found.decoded} />
        <SavedThatFit decoded={found.decoded} timeZone={timeZone} />
      </div>
    );
  }
  return <Refused code={code} fields={found.fields} />;
}

/** The saved Spec ID with the code pasted: a perfect match, any that had it before, then the others that fit or might. */
function Matched({ lookup, timeZone }: { lookup: SpecIdLookup; timeZone?: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <MatchCard saved={lookup} exact code={lookup.code} timeZone={timeZone} />
        {lookup.formerHolders.map((holder) => (
          <FormerHolderNote key={holder.id} holder={holder} timeZone={timeZone} />
        ))}
      </div>
      <SavedThatFit decoded={lookup} leaveOut={lookup.id} timeZone={timeZone} />
    </div>
  );
}

/** The Spec ID a pasted code became: no Spec ID has it now, and this one had it last. */
function Replaced({ lookup, timeZone }: { lookup: SpecIdLookup; timeZone?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm">
        <Sentence>{`This code was updated. It's now ${lookup.code}.`}</Sentence>
        <SpecIdSummary saved={lookup} timeZone={timeZone} />
        <OpenLink id={lookup.id} />
      </section>
      {lookup.formerHolders.map((holder) => (
        <FormerHolderNote key={holder.id} holder={holder} timeZone={timeZone} />
      ))}
    </div>
  );
}

function FormerHolderNote({ holder, timeZone }: { holder: FormerHolder; timeZone?: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-surface border border-border bg-surface p-4">
      <p className="text-sm break-words text-ink">
        {`This code also belonged to "${holder.name}" until ${formatSavedDate(holder.until, timeZone)}. It's now ${holder.code}.`}
      </p>
      <OpenLink id={holder.id} />
    </section>
  );
}

function Unsaved({ code, decoded }: { code: string; decoded: DecodedSpecId }) {
  const shown = decoded.slots.filter((slot) => slot.state !== 'does-not-apply');
  const folded = decoded.slots.filter((slot) => slot.state === 'does-not-apply');
  return (
    <section className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm">
      <Sentence>This Spec ID isn't saved yet.</Sentence>
      <Link to={`/atlas/new?code=${encodeURIComponent(code)}`} className={LINK}>
        Start a Spec ID from it
        <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </Link>
      <DecodedSlotsTable rows={shown} />
      {folded.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink-muted [&::-webkit-details-marker]:hidden">
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="transition-transform duration-150 ease-standard group-open:rotate-180"
            />
            {folded.length === 1 ? "1 slot doesn't apply" : `${folded.length} slots don't apply`}
          </summary>
          <div className="mt-3">
            <DecodedSlotsTable rows={folded} />
          </div>
        </details>
      )}
    </section>
  );
}

/**
 * A code the decoder refused: its messages about the whole code, then, for a
 * dotted code given out before with all 25 parts, each part with the messages
 * about it. A code written today has its messages only.
 */
function Refused({ code, fields }: { code: string; fields: Record<string, string[]> }) {
  const parts = code.split('.');
  const dotted = parts.length === SLOT_NAMES.length;
  const rows: DecodedSlotRow[] = SLOT_NAMES.map((slot, index) => ({
    number: index + 1,
    key: slot.key,
    name: slot.name,
    part: parts[index] ?? '',
    meaning: '',
    messages: fields[slot.key],
  }));
  return (
    <div className="flex flex-col gap-4">
      {fields.code?.map((message) => (
        <p key={message} role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {message}
        </p>
      ))}
      {dotted && <DecodedSlotsTable rows={rows} />}
    </div>
  );
}

/**
 * The saved Spec IDs with the same facts as a code in other sizes; then those
 * with every fact it gives that record more: `A16B24V2` finds each paper bag
 * with a twisted handle, at any size. Then those that might: nothing
 * contradicts, but some of its facts aren't recorded. The perfect match above,
 * `leaveOut`, is not listed again; when it is the only one that fits, nothing
 * more is said.
 */
function SavedThatFit({ decoded, leaveOut, timeZone }: { decoded: DecodedSpecId; leaveOut?: string; timeZone?: string }) {
  const similar = useSimilarSpecIds(knownCriteria(decoded));
  if (similar.isPending) {
    return (
      <SkeletonRegion label="Spec IDs" className="flex flex-col gap-3">
        {[0, 1].map((card) => (
          <SkeletonBlock key={card} className="h-32 w-full rounded-surface" order={card} />
        ))}
      </SkeletonRegion>
    );
  }
  if (similar.isError) return <ErrorState message={similar.error.message} onRetry={() => void similar.refetch()} />;

  const fitting = similar.data.fits.filter((saved) => saved.id !== leaveOut);
  // Those with the same facts are listed in their own group, above.
  const fits = fitting.filter((saved) => !hasSameFacts(decoded.code, saved));
  const mightFit = similar.data.mightFit.filter((saved) => saved.id !== leaveOut);
  return (
    <>
      {fitting.length === 0 && leaveOut === undefined && (
        <p role="status" className="text-sm text-ink-muted">
          No saved Spec ID has every fact in this code.
        </p>
      )}
      <SameFactsGroup decoded={decoded} leaveOut={leaveOut} timeZone={timeZone} />
      {fits.length > 0 && <SpecIdGroup title={FITS} items={fits} timeZone={timeZone} />}
      {mightFit.length > 0 && <SpecIdGroup title={MIGHT_FIT} items={mightFit} timeZone={timeZone} />}
    </>
  );
}

function Sentence({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-md font-medium break-words text-ink">
      {children}
    </p>
  );
}

function OpenLink({ id }: { id: string }) {
  return (
    <Link to={`/atlas/${id}`} className={LINK}>
      Open
      <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
