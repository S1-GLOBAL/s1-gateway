import { useEffect, useState } from 'react';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { TextField } from '@/shared/ui/TextField';
import { useCodeLookup } from '../../application/use-code-lookup';
import { useSpecIdLibrary } from '../../application/use-spec-id-library';
import type { AtlasDictionary } from '../../domain/atlas';
import { asPastedCode } from '../../domain/pasted-code';
import { LibraryList } from './LibraryList';
import { PastedCodeResult } from './PastedCodeResult';

/** How long the search waits after the last keystroke before it asks. */
export const SEARCH_WAIT_MS = 250;

/**
 * One search box for a name or a pasted code, a product-type filter, and what
 * they find: the library's cards, or what the pasted code is.
 */
export function AtlasLibrary({ dictionary, timeZone }: { dictionary: AtlasDictionary; timeZone?: string }) {
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const [productType, setProductType] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setAsked(text.trim()), SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const code = asPastedCode(asked);
  const library = useSpecIdLibrary({ q: asked, productType }, code === null);
  const lookup = useCodeLookup(code);
  const productTypes = dictionary.slots.find((slot) => slot.key === 'productType')?.values ?? [];
  const refused = code === null && library.error?.code === 'VALIDATION_FAILED' ? library.error.fields.q : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <TextField
          label="Search"
          type="search"
          placeholder="Search by name, or paste a Spec ID"
          value={text}
          onChange={(event) => setText(event.target.value)}
          errors={refused}
          autoComplete="off"
          spellCheck={false}
        />
        {code === null && (
          <SegmentedControl
            label="Product type"
            value={productType}
            options={[
              { value: '', label: 'All' },
              ...productTypes.map(({ code: value, meaning }) => ({ value, label: meaning })),
            ]}
            onChange={setProductType}
            className="flex-wrap self-start"
          />
        )}
      </div>

      {code === null ? (
        <LibraryList
          library={library}
          q={asked}
          productTypeName={productTypes.find((value) => value.code === productType)?.meaning}
          timeZone={timeZone}
        />
      ) : (
        <PastedCodeResult code={code} result={lookup} timeZone={timeZone} />
      )}
    </div>
  );
}
