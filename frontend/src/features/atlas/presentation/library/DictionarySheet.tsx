import { useState } from 'react';
import { cn } from '@/shared/ui/cn';
import { Sheet } from '@/shared/ui/Sheet';
import type { AtlasDictionary } from '../../domain/atlas';
import { dictionaryHeading } from '../../domain/dictionary-heading';
import { DictionaryBrowser } from '../DictionaryBrowser';
import { SuggestionForm, type SuggestionRequest } from '../dictionary/SuggestionForm';

export interface DictionarySheetProps {
  dictionary: AtlasDictionary;
  open: boolean;
  onClose(): void;
  timeZone?: string;
}

/**
 * The dictionary in a side panel: every value of every slot, with its
 * approved search words, and which slots apply to the product type you
 * choose. Wider than a usual sheet, so the values sit in two columns. Anyone
 * may suggest a change from here (#95); the form opens over the panel, and
 * what it sent is said at the top.
 */
export function DictionarySheet({ dictionary, open, onClose, timeZone }: DictionarySheetProps) {
  const [request, setRequest] = useState<SuggestionRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The form is the panel's sibling, not its child: a dialog's close event
  // would otherwise reach the panel's own onClose and shut both.
  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Dictionary"
        description={dictionaryHeading(dictionary, timeZone)}
        className="max-w-3xl"
      >
        <div className="flex flex-col gap-6">
          <p
            role="status"
            className={cn(notice ? 'rounded-control bg-success-soft px-3 py-2 text-sm text-success' : 'sr-only')}
          >
            {notice}
          </p>
          <DictionaryBrowser
            dictionary={dictionary}
            onSuggest={(target) => {
              setNotice(null);
              setRequest({ target, editing: null });
            }}
          />
        </div>
      </Sheet>
      <SuggestionForm
        request={request}
        dictionary={dictionary}
        onClose={() => setRequest(null)}
        onSent={(message) => {
          setRequest(null);
          setNotice(message);
        }}
      />
    </>
  );
}
