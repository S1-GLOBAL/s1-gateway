import type { AtlasDictionary } from './atlas';
import { formatSavedDate } from './format-saved-date';

/**
 * The Dictionary sheet's header, as #95 words it: "S2, change 3, 27 October
 * 2026." once a change is approved, and "S2, approved 19 October 2026." before
 * the first. The release's name is its first word.
 */
export function dictionaryHeading(dictionary: AtlasDictionary, timeZone?: string): string {
  const name = dictionary.release.split(' ')[0] ?? dictionary.release;
  if (dictionary.change) return `${name}, change ${dictionary.change.number}, ${formatSavedDate(dictionary.change.at, timeZone)}.`;
  // `approvedOn` is a day with no time: read in UTC, so no time zone moves it.
  return `${name}, approved ${formatSavedDate(new Date(dictionary.approvedOn), 'UTC')}.`;
}
