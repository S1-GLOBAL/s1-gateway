import { CircleCheck } from 'lucide-react';
import * as m from 'motion/react-m';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import { ArrowRightIcon } from '@/shared/ui/icons';
import { useIconTrigger } from '@/shared/ui/motion';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SelectField } from '@/shared/ui/SelectField';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import { useSearchMatch } from '../../application/use-search-match';
import type { useReadText } from '../../application/use-read-text';
import type { SearchMatch } from '../../application/use-search-match';
import type { AtlasDictionary, DecodedSpecId, SlotRuleEntry, SpecIdTextReading } from '../../domain/atlas';
import { dictionaryOptions } from '../dictionary-options';
import { NewSpecIdLink } from './NewSpecIdLink';
import { SpecIdCard } from './SpecIdCard';
import { TextSearchResults } from './TextSearchResults';

const MotionLink = m.create(Link);

const CARD = 'flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm';

/** A link that looks like the secondary button. */
const SECONDARY_LINK =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised';

export interface TextSearchProps {
  /** The reading of the text as it is typed. */
  reading: ReturnType<typeof useReadText>;
  /** The text read, trimmed. */
  text: string;
  dictionary: AtlasDictionary;
  /** Reads the text again as this product type. */
  onChooseProductType: (productType: string) => void;
  timeZone?: string;
}

/**
 * What the text reads as, while it is typed: the code, the way to correct it,
 * and the saved Spec IDs that fit or might; or a product type to choose; or
 * that it read nothing. The last reading stays, dimmed, while the next is
 * read. Nothing is saved until Save as a new Spec ID is pressed.
 */
export function TextSearch({ reading, text, dictionary, onChooseProductType, timeZone }: TextSearchProps) {
  if (reading.isPending) {
    return (
      <SkeletonRegion label="Search">
        <SkeletonBlock className="h-40 w-full rounded-surface" />
      </SkeletonRegion>
    );
  }
  if (reading.isError) {
    // Refused text: its message is already beside the box.
    if (reading.error.code === 'VALIDATION_FAILED') return null;
    return <ErrorState message={reading.error.message} onRetry={() => void reading.refetch()} />;
  }
  const found = reading.data;
  if (!found) return null;

  // An older reading, shown while the text as it is now is read.
  const busy = reading.isPlaceholderData;
  if (found.decoded) {
    return (
      <CodeOrMatch
        reading={found}
        decoded={found.decoded}
        text={text}
        rules={dictionary.rules}
        busy={busy}
        timeZone={timeZone}
      />
    );
  }
  if (found.read.length === 0) return <NoFacts reading={found} busy={busy} />;
  return <NoProductType reading={found} dictionary={dictionary} busy={busy} onChoose={onChooseProductType} />;
}

/**
 * The saved Spec ID the facts answer, when there is one: the one whose code
 * they make, or the only one that fits them all. Else the code to confirm.
 * Until the lookups answer, the code shows, so the card never blanks between
 * keystrokes.
 */
function CodeOrMatch(props: {
  reading: SpecIdTextReading;
  decoded: DecodedSpecId;
  text: string;
  rules: readonly SlotRuleEntry[];
  busy: boolean;
  timeZone?: string;
}) {
  const match = useSearchMatch(props.decoded);
  if (match) {
    return (
      <div className="flex flex-col gap-6">
        <Match match={match} decoded={props.decoded} timeZone={props.timeZone} />
        <TextSearchResults decoded={props.decoded} text={props.text} rules={props.rules} matchedId={match.saved.id} timeZone={props.timeZone} />
      </div>
    );
  }
  return <CodeBuilt {...props} />;
}

/**
 * The saved Spec ID the facts answer: nothing to confirm. A perfect match has
 * exactly the facts read; a match has them all and records more. Starting
 * another opens New Spec ID with the facts read, where, for a perfect match,
 * Save waits until one of them changes, so it is never saved twice.
 */
function Match({ match, decoded, timeZone }: { match: SearchMatch; decoded: DecodedSpecId; timeZone?: string }) {
  const { saved, exact } = match;
  // The arrow plays on hover only.
  const { trigger } = useIconTrigger();
  return (
    <section
      aria-label={exact ? 'Perfect match' : 'Match'}
      className="flex flex-col gap-4 rounded-surface border border-accent bg-accent-soft p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <p role="status" className="inline-flex items-center gap-2 text-md font-medium text-accent-ink">
          <CircleCheck size={20} strokeWidth={1.75} aria-hidden="true" />
          {exact ? 'We found a perfect match!' : 'We found a match!'}
        </p>
        {!exact && <p className="text-sm text-ink-muted">It has every fact you typed, and records more.</p>}
      </div>
      <SpecIdCard saved={saved} timeZone={timeZone} />
      <MotionLink
        to={`/atlas/new?code=${encodeURIComponent(decoded.code)}`}
        initial={trigger.initial}
        animate={trigger.animate}
        onHoverStart={trigger.onHoverStart}
        className={cn(SECONDARY_LINK, 'self-start')}
      >
        This is not what I'm looking for, create a Spec ID
        <ArrowRightIcon size={16} />
      </MotionLink>
    </section>
  );
}

/** A reading card, dimmed while an older reading stands in for the next. */
function cardFor(busy: boolean): string {
  return busy ? `${CARD} opacity-60 transition-opacity` : `${CARD} transition-opacity`;
}

function CodeBuilt({
  reading,
  decoded,
  text,
  rules,
  busy,
  timeZone,
}: {
  reading: SpecIdTextReading;
  decoded: DecodedSpecId;
  text: string;
  rules: readonly SlotRuleEntry[];
  busy: boolean;
  timeZone?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="What Search read" aria-busy={busy} className={cardFor(busy)}>
        <p role="status" className="text-md font-medium text-ink">
          Does this code look right?
        </p>
        <p
          aria-label="Spec ID"
          className="self-start rounded-control bg-accent-soft px-3 py-1.5 font-mono text-lg font-semibold break-all text-accent-ink"
        >
          {decoded.code}
        </p>
        <WhatWasRead reading={reading} />
        <div className="flex flex-wrap gap-3">
          <Link to={`/atlas/new?code=${encodeURIComponent(decoded.code)}`} className={SECONDARY_LINK}>
            No, edit it
          </Link>
        </div>
      </section>
      <TextSearchResults decoded={decoded} text={text} rules={rules} timeZone={timeZone} />
    </div>
  );
}

function NoProductType({
  reading,
  dictionary,
  busy,
  onChoose,
}: {
  reading: SpecIdTextReading;
  dictionary: AtlasDictionary;
  busy: boolean;
  onChoose: (productType: string) => void;
}) {
  return (
    <section aria-label="What Search read" aria-busy={busy} className={cardFor(busy)}>
      <WhatWasRead reading={reading} />
      <p role="status" className="text-md font-medium text-ink">
        Couldn't tell what product this is. Choose a product type:
      </p>
      <SelectField
        label="Product type to read as"
        options={dictionaryOptions(dictionary, 'productType', { value: '', label: '' })}
        value=""
        onChange={(event) => {
          if (event.target.value !== '') onChoose(event.target.value);
        }}
      />
    </section>
  );
}

function NoFacts({ reading, busy }: { reading: SpecIdTextReading; busy: boolean }) {
  return (
    <section aria-label="What Search read" aria-busy={busy} className={cardFor(busy)}>
      <p role="status" className="text-md font-medium text-ink">
        No facts found in your text. Check the wording, or start a Spec ID by hand.
      </p>
      <Notes reading={reading} />
      <div className="flex">
        <NewSpecIdLink />
      </div>
    </section>
  );
}

/** What the reader noted, each fact it read, and the words it left out when it left any. */
function WhatWasRead({ reading }: { reading: SpecIdTextReading }) {
  return (
    <>
      <Notes reading={reading} />
      {reading.read.length > 0 && (
        <ul aria-label="Read from your text" className="flex list-disc flex-col gap-1 pl-5 text-sm break-words text-ink">
          {reading.read.map((fact) => (
            <li key={fact.key}>{`${fact.name}: ${fact.meaning}`}</li>
          ))}
        </ul>
      )}
      {reading.ignored.length > 0 && (
        <p className="text-sm break-words text-ink-muted">{`Left out: ${reading.ignored.join(', ')}`}</p>
      )}
    </>
  );
}

/**
 * The reader's sentences: a lid named by what it fits, two values for one
 * fact, a size converted, what a word left over could mean.
 */
function Notes({ reading }: { reading: SpecIdTextReading }) {
  if (reading.notes.length === 0) return null;
  return (
    <ul aria-label="Notes" className="flex list-disc flex-col gap-1 pl-5 text-sm break-words text-warning">
      {reading.notes.map((note, index) => (
        <li key={index}>{note}</li>
      ))}
    </ul>
  );
}
