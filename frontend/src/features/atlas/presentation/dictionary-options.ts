import type { SelectOption } from '@/shared/ui/SelectField';
import type { AtlasDictionary, SlotKey } from '../domain/atlas';

/** A slot's dictionary values as a select's options: `RD — Round`, after `leading` when there is one. */
export function dictionaryOptions(dictionary: AtlasDictionary, key: SlotKey, leading?: SelectOption): SelectOption[] {
  const values = dictionary.slots.find((slot) => slot.key === key)?.values ?? [];
  const options = values.map(({ code, meaning }) => ({ value: code, label: `${code} — ${meaning}` }));
  return leading ? [leading, ...options] : options;
}
