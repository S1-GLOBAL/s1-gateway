/** Where Atlas keeps its last search, for this browser tab only. */
export const LAST_SEARCH_KEY = 's1-gateway.atlas-search';

/**
 * The search last asked on Atlas in this tab, or an empty string. It brings a
 * search back when Atlas is opened again without one, such as from a Spec ID's
 * "Atlas" link.
 */
export function readLastSearch(): string {
  try {
    return window.sessionStorage.getItem(LAST_SEARCH_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberSearch(text: string): void {
  try {
    if (text === '') window.sessionStorage.removeItem(LAST_SEARCH_KEY);
    else window.sessionStorage.setItem(LAST_SEARCH_KEY, text);
  } catch {
    // Not remembered; the address still holds it while Atlas is open.
  }
}
