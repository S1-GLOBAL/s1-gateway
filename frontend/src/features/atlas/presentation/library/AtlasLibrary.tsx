import { useEffect, useState } from 'react';
import { TextField } from '@/shared/ui/TextField';
import { useCodeLookup } from '../../application/use-code-lookup';
import { useSearchMatch } from '../../application/use-search-match';
import { useReadText } from '../../application/use-read-text';
import { useSpecIdLibrary } from '../../application/use-spec-id-library';
import type { AtlasDictionary } from '../../domain/atlas';
import { asPastedCode } from '../../domain/pasted-code';
import { LibraryList } from './LibraryList';
import { PastedCodeResult } from './PastedCodeResult';
import { TextSearch } from './TextSearch';

/** How long the search waits after the last keystroke before it asks. */
export const SEARCH_WAIT_MS = 250;

/** The fewest characters read for their facts: one letter reads as nothing yet. */
export const READ_MIN_LENGTH = 2;

/** The longest text the name search takes. Longer text is only read for its facts, up to 500 characters. */
export const NAME_SEARCH_MAX_LENGTH = 120;

/**
 * One search box for a name or a pasted code, and what they find: what the pasted code is; or, for any other text, the code its
 * facts make as it is typed, with the reader's notes, above the library's
 * cards whose names match (ADR 0032).
 *
 * `untilAsked` keeps the library out of sight until something is typed. The
 * search itself is unchanged. `initialText` starts the box with a search asked
 * before, read at once; `onAsk` hears each search once typing pauses, so the
 * page can keep it for the way back.
 */
export function AtlasLibrary({
  dictionary,
  timeZone,
  untilAsked = false,
  initialText = '',
  onAsk,
}: {
  dictionary: AtlasDictionary;
  timeZone?: string;
  untilAsked?: boolean;
  initialText?: string;
  onAsk?: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [asked, setAsked] = useState(initialText.trim());
  const [page, setPage] = useState(1);
  /** A product type chosen for text that names none, kept while the text is the one it was chosen for. */
  const [chosen, setChosen] = useState<{ text: string; productType: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAsked(text.trim());
      onAsk?.(text.trim());
    }, SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
    // `onAsk` may be a new function each render; only the text decides when to ask.
  }, [text]);

  const code = asPastedCode(asked);
  const namesAsked = code === null && asked.length <= NAME_SEARCH_MAX_LENGTH;
  /** Nothing has been asked for, so the library stays out of the way. */
  const idle = untilAsked && asked === '';
  const productTypeChosen = chosen?.text === asked ? chosen.productType : undefined;
  const reading = useReadText(
    code === null && asked.length >= READ_MIN_LENGTH
      ? { text: asked, ...(productTypeChosen === undefined ? {} : { productType: productTypeChosen }) }
      : null,
  );
  const [filterSeen, setFilterSeen] = useState(asked);
  const requestedPage = filterSeen === asked ? page : 1;
  const library = useSpecIdLibrary({ q: asked, productType: '', page: requestedPage }, namesAsked && !idle);
  if (filterSeen !== asked) {
    setFilterSeen(asked);
    if (page !== 1) setPage(1);
  } else if (library.data && !library.isPlaceholderData && library.data.page !== requestedPage) {
    setPage(library.data.page);
  }
  const lookup = useCodeLookup(code);
  // The saved Spec ID the reading answers, shown above as a match: the list leaves it out.
  const match = useSearchMatch(reading.data?.decoded);
  const readRefused = reading.error?.code === 'VALIDATION_FAILED' ? reading.error.fields.text : undefined;
  const namesRefused = namesAsked && library.error?.code === 'VALIDATION_FAILED' ? library.error.fields.q : undefined;

  return (
    <div className="flex flex-col gap-6">
      <TextField
        label="Search"
        type="search"
        placeholder="Search by name, or paste a Spec ID"
        value={text}
        onChange={(event) => setText(event.target.value)}
        errors={readRefused ?? namesRefused}
        autoComplete="off"
        spellCheck={false}
      />

      {code === null && asked.length >= READ_MIN_LENGTH && (
        <TextSearch
          // What was confirmed for one text is not confirmed for the next.
          key={`${asked}|${productTypeChosen ?? ''}`}
          reading={reading}
          text={asked}
          dictionary={dictionary}
          onChooseProductType={(productType) => setChosen({ text: asked, productType })}
          timeZone={timeZone}
        />
      )}
      {code !== null ? (
        <PastedCodeResult code={code} result={lookup} timeZone={timeZone} />
      ) : namesAsked && !idle ? (
        <LibraryList
          library={library}
          q={asked}
          productTypeName={undefined}
          page={requestedPage}
          onPageChange={setPage}
          shownAbove={code === null && asked.length >= READ_MIN_LENGTH ? match?.saved.id : undefined}
          timeZone={timeZone}
        />
      ) : null}
    </div>
  );
}
