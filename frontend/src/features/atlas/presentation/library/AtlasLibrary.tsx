import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { TextField } from '@/shared/ui/TextField';
import { useCodeLookup } from '../../application/use-code-lookup';
import { useReadText } from '../../application/use-read-text';
import { useSpecIdLibrary } from '../../application/use-spec-id-library';
import type { AtlasDictionary, DictionaryValue } from '../../domain/atlas';
import { asPastedCode } from '../../domain/pasted-code';
import { LibraryList, NO_NAMES_MATCH } from './LibraryList';
import { PastedCodeResult } from './PastedCodeResult';
import { TextSearch } from './TextSearch';

/** How long the search waits after the last keystroke before it asks. */
export const SEARCH_WAIT_MS = 250;

/** The longest text the name search takes. Longer text is only read by Search, which takes up to 500. */
export const NAME_SEARCH_MAX_LENGTH = 120;

/**
 * One search box for a name or a pasted code, a product-type filter, and what
 * they find: the library's cards, or what the pasted code is. Search reads the
 * facts in text that isn't a code, and shows what it read in the list's place
 * until the text changes.
 */
export function AtlasLibrary({ dictionary, timeZone }: { dictionary: AtlasDictionary; timeZone?: string }) {
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const [productType, setProductType] = useState('');
  const [page, setPage] = useState(1);
  /** The text Search read, until the text changes; null while the name list shows. */
  const [searched, setSearched] = useState<string | null>(null);
  const reading = useReadText();

  useEffect(() => {
    const timer = setTimeout(() => setAsked(text.trim()), SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const code = asPastedCode(asked);
  const namesAsked = code === null && asked.length <= NAME_SEARCH_MAX_LENGTH;
  const filterKey = `${asked}\0${productType}`;
  const [filterSeen, setFilterSeen] = useState(filterKey);
  const requestedPage = filterSeen === filterKey ? page : 1;
  const library = useSpecIdLibrary({ q: asked, productType, page: requestedPage }, namesAsked);
  if (filterSeen !== filterKey) {
    setFilterSeen(filterKey);
    if (page !== 1) setPage(1);
  } else if (library.data && !library.isPlaceholderData && library.data.page !== requestedPage) {
    setPage(library.data.page);
  }
  const lookup = useCodeLookup(code);
  const productTypes = dictionary.slots.find((slot) => slot.key === 'productType')?.values ?? [];
  const typed = text.trim();
  const canSearch = typed !== '' && asPastedCode(typed) === null;
  const readRefused =
    searched !== null && reading.error?.code === 'VALIDATION_FAILED' ? reading.error.fields.text : undefined;
  const namesRefused = namesAsked && library.error?.code === 'VALIDATION_FAILED' ? library.error.fields.q : undefined;

  function changeText(value: string) {
    setText(value);
    setSearched(null);
    reading.reset();
  }

  function search() {
    setSearched(typed);
    reading.mutate({ text: typed });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <TextField
          label="Search"
          type="search"
          placeholder="Search by name, or paste a Spec ID"
          value={text}
          onChange={(event) => changeText(event.target.value)}
          errors={readRefused ?? namesRefused}
          autoComplete="off"
          spellCheck={false}
          action={
            canSearch ? (
              <Button variant="secondary" loading={reading.isPending} onClick={search}>
                Search
              </Button>
            ) : null
          }
        />
        {code === null && searched === null && (
          <ProductTypeFilter productType={productType} productTypes={productTypes} onChange={setProductType} />
        )}
      </div>

      {searched !== null ? (
        <TextSearch
          key={reading.submittedAt}
          reading={reading}
          text={searched}
          dictionary={dictionary}
          timeZone={timeZone}
        />
      ) : code !== null ? (
        <PastedCodeResult code={code} result={lookup} timeZone={timeZone} />
      ) : namesAsked ? (
        <LibraryList
          library={library}
          q={asked}
          productTypeName={productTypes.find((value) => value.code === productType)?.meaning}
          page={requestedPage}
          onPageChange={setPage}
          timeZone={timeZone}
        />
      ) : (
        <p role="status" className="text-sm text-ink-muted">
          {NO_NAMES_MATCH}
        </p>
      )}
    </div>
  );
}

/**
 * The product-type choices, folded under a summary that names the one in
 * force. Folded at first, so the list can sit higher.
 */
function ProductTypeFilter({
  productType,
  productTypes,
  onChange,
}: {
  productType: string;
  productTypes: readonly DictionaryValue[];
  onChange: (value: string) => void;
}) {
  const current = productTypes.find((value) => value.code === productType)?.meaning ?? 'All';

  return (
    <details className="group flex flex-col gap-2">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="shrink-0 text-ink-muted transition-transform duration-150 ease-standard group-open:rotate-180"
        />
        <span className="text-ink">
          Product type
          <span className={productType ? 'font-normal text-ink' : 'font-normal text-ink-muted'}>{` · ${current}`}</span>
        </span>
      </summary>
      <SegmentedControl
        label="Product type"
        value={productType}
        options={[
          { value: '', label: 'All' },
          ...productTypes.map(({ code: value, meaning }) => ({ value, label: meaning })),
        ]}
        onChange={onChange}
        className="flex-wrap self-start"
      />
    </details>
  );
}
