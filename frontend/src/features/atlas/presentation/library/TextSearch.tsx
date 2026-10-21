import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SelectField } from '@/shared/ui/SelectField';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import type { useReadText } from '../../application/use-read-text';
import type { AtlasDictionary, DecodedSpecId, SpecIdTextReading } from '../../domain/atlas';
import { conflictSentence, readInWords } from '../../domain/text-reading';
import { dictionaryOptions } from '../dictionary-options';
import { NewSpecIdLink } from './NewSpecIdLink';
import { TextSearchResults } from './TextSearchResults';

const CARD = 'flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm';

/** A link that looks like the secondary button. */
const SECONDARY_LINK =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised';

export interface TextSearchProps {
  /** The reading Search asked for. */
  reading: ReturnType<typeof useReadText>;
  /** The text Search read, trimmed. */
  text: string;
  dictionary: AtlasDictionary;
  timeZone?: string;
}

/**
 * What Search read in the text, to confirm before anything is looked up: the
 * code and the way to correct it; or a product type to choose; or that it
 * read nothing. Nothing is saved.
 */
export function TextSearch({ reading, text, dictionary, timeZone }: TextSearchProps) {
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
    const asked = reading.variables;
    return <ErrorState message={reading.error.message} onRetry={() => reading.mutate(asked)} />;
  }
  const found = reading.data;
  if (!found) return null;

  if (found.decoded) return <CodeBuilt reading={found} decoded={found.decoded} timeZone={timeZone} />;
  if (found.read.length === 0) return <NoFacts reading={found} />;
  return (
    <NoProductType
      reading={found}
      dictionary={dictionary}
      onChoose={(productType) => reading.mutate({ text, productType })}
    />
  );
}

function CodeBuilt({
  reading,
  decoded,
  timeZone,
}: {
  reading: SpecIdTextReading;
  decoded: DecodedSpecId;
  timeZone?: string;
}) {
  const [proceeding, setProceeding] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="What Search read" className={CARD}>
        <p role="status" className="text-md font-medium text-ink">
          Does this code look right?
        </p>
        <WhatWasRead reading={reading} />
        <p className="font-mono text-sm break-all text-ink">{decoded.code}</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setProceeding(true)}>Yes, proceed</Button>
          <Link to={`/atlas/new?code=${encodeURIComponent(decoded.code)}`} className={SECONDARY_LINK}>
            No, edit it
          </Link>
        </div>
      </section>
      {proceeding && <TextSearchResults decoded={decoded} timeZone={timeZone} />}
    </div>
  );
}

function NoProductType({
  reading,
  dictionary,
  onChoose,
}: {
  reading: SpecIdTextReading;
  dictionary: AtlasDictionary;
  onChoose: (productType: string) => void;
}) {
  return (
    <section aria-label="What Search read" className={CARD}>
      <WhatWasRead reading={reading} />
      <p role="status" className="text-md font-medium text-ink">
        Couldn't tell what product this is. Choose a product type:
      </p>
      <SelectField
        label="Product type"
        options={dictionaryOptions(dictionary, 'productType', { value: '', label: '' })}
        value=""
        onChange={(event) => {
          if (event.target.value !== '') onChoose(event.target.value);
        }}
      />
    </section>
  );
}

function NoFacts({ reading }: { reading: SpecIdTextReading }) {
  return (
    <section aria-label="What Search read" className={CARD}>
      <p role="status" className="text-md font-medium text-ink">
        No facts found in your text. Check the wording, or start a Spec ID by hand.
      </p>
      <Conflicts reading={reading} />
      <div className="flex">
        <NewSpecIdLink />
      </div>
    </section>
  );
}

/** What was read, what was ignored when anything was, and each fact found twice. */
function WhatWasRead({ reading }: { reading: SpecIdTextReading }) {
  return (
    <>
      <p className="text-sm break-words text-ink">{`Read from your text: ${readInWords(reading)}`}</p>
      {reading.ignored.length > 0 && (
        <p className="text-sm break-words text-ink-muted">{`Ignored: ${reading.ignored.join(', ')}`}</p>
      )}
      <Conflicts reading={reading} />
    </>
  );
}

function Conflicts({ reading }: { reading: SpecIdTextReading }) {
  return reading.conflicts.map((conflict) => (
    <p key={conflict.key} className="text-sm break-words text-ink-muted">
      {conflictSentence(conflict)}
    </p>
  ));
}
