import type { SelectOption } from '@/shared/ui/SelectField';
import type { AtlasDictionary, SlotKey } from '../domain/atlas';
import { byNumber, valueCode } from '../domain/code-letters';

/**
 * A slot's dictionary values as a select's options, after `leading` when there
 * is one. Each reads as a code writes it, `E1 — Round`, and sends its
 * dictionary code, `RD`.
 */
export function dictionaryOptions(dictionary: AtlasDictionary, key: SlotKey, leading?: SelectOption): SelectOption[] {
  const values = dictionary.slots.find((slot) => slot.key === key)?.values ?? [];
  const options = byNumber(values).map(({ code, meaning, number }) => ({
    value: code,
    label: `${valueCode(key, number)} — ${meaning}`,
  }));
  return leading ? [leading, ...options] : options;
}
