import { ArrowRight, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import type { useCodeLookup } from '../../application/use-code-lookup';
import { SLOT_NAMES, type DecodedSpecId, type FormerHolder, type SpecIdLookup } from '../../domain/atlas';
import { formatSavedDate } from '../../domain/format-saved-date';
import { DecodedSlotsTable, type DecodedSlotRow } from '../DecodedSlotsTable';
import { SpecIdSummary } from './SpecIdSummary';

const LINK =
  'inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-ink underline-offset-4 hover:underline';

export interface PastedCodeResultProps {
  /** The code pasted, trimmed and upper-cased. */
  code: string;
  result: ReturnType<typeof useCodeLookup>;
  timeZone?: string;
}

/**
 * What a pasted code is: the saved Spec ID that has it, with a note for each
 * that had it before; the one it became; or, unsaved, its slots in plain
 * words and the way to start a Spec ID from it; or the decoder's messages.
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
  if (found.kind === 'saved') return <Saved lookup={found.lookup} timeZone={timeZone} />;
  if (found.kind === 'unsaved') return <Unsaved code={code} decoded={found.decoded} />;
  return <Refused code={code} fields={found.fields} />;
}

function Saved({ lookup, timeZone }: { lookup: SpecIdLookup; timeZone?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm">
        <Sentence>
          {lookup.replacedCode === null
            ? `Saved as "${lookup.name}".`
            : `This code was updated. It's now ${lookup.code}.`}
        </Sentence>
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
