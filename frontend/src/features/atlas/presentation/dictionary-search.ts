import type { AtlasDictionary } from '../domain/atlas';
import { valueCode } from '../domain/code-letters';

/** One dictionary value a search found, with the slot it belongs to. */
export interface DictionaryHit {
  slotKey: string;
  slotName: string;
  code: string;
  /** How a code writes the value: `B17`. */
  part: string;
  meaning: string;
}

/** How many matches the suggestion list shows. The rest stay in the slot lists. */
export const SUGGESTIONS_SHOWN = 8;

/**
 * Every value whose code or meaning contains `query`, or whose code as written
 * today (`B17`) starts with it, best match first. An exact code comes before
 * a code that starts with the text, then a meaning that starts with it, then
 * any other containing match. An empty query matches nothing: the dictionary
 * is already on screen.
 */
export function searchDictionary(dictionary: AtlasDictionary, query: string): DictionaryHit[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];

  const hits: DictionaryHit[] = [];
  for (const slot of dictionary.slots) {
    for (const value of slot.values) {
      const part = valueCode(slot.key, value.number);
      if (
        part.toLowerCase().startsWith(needle) ||
        value.code.toLowerCase().includes(needle) ||
        value.meaning.toLowerCase().includes(needle)
      ) {
        hits.push({ slotKey: slot.key, slotName: slot.name, code: value.code, part, meaning: value.meaning });
      }
    }
  }

  return hits.sort((a, b) => rank(a, needle) - rank(b, needle));
}

function rank(hit: DictionaryHit, needle: string): number {
  const code = hit.code.toLowerCase();
  const part = hit.part.toLowerCase();
  const meaning = hit.meaning.toLowerCase();
  if (code === needle || part === needle) return 0;
  if (code.startsWith(needle) || part.startsWith(needle)) return 1;
  if (meaning.startsWith(needle)) return 2;
  if (code.includes(needle)) return 3;
  return 4;
}
