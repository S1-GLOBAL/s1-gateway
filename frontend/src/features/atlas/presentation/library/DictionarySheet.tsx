import { Sheet } from '@/shared/ui/Sheet';
import type { AtlasDictionary } from '../../domain/atlas';
import { formatSavedDate } from '../../domain/format-saved-date';
import { DictionaryBrowser } from '../DictionaryBrowser';

export interface DictionarySheetProps {
  dictionary: AtlasDictionary;
  open: boolean;
  onClose(): void;
}

/**
 * The dictionary in a side panel: every value of every slot, and which slots
 * apply to the product type you choose. Wider than a usual sheet, so the
 * values sit in two columns.
 */
export function DictionarySheet({ dictionary, open, onClose }: DictionarySheetProps) {
  // `approvedOn` is a day with no time: read in UTC, so no time zone moves it.
  const approved = formatSavedDate(new Date(dictionary.approvedOn), 'UTC');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Dictionary"
      description={`${dictionary.release}, approved ${approved}. It changes only by migration.`}
      className="max-w-3xl"
    >
      <DictionaryBrowser dictionary={dictionary} />
    </Sheet>
  );
}
