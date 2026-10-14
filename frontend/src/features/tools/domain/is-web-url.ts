/**
 * Only http and https become links. The backend refuses anything else, and
 * this keeps a `javascript:` URL inert even if one ever reached the database.
 *
 * `new URL` in a try, not `URL.canParse`: the installed PWA must run on
 * Safari 16, which does not have it.
 */
export function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
