import type { LibraryCursor } from '../domain/spec-id-repository.js';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where the next library page starts, as an opaque string for the query. */
export function encodeLibraryCursor(cursor: LibraryCursor): string {
  return Buffer.from(`${cursor.lastChangedAt.toISOString()}|${cursor.id}`, 'utf8').toString('base64url');
}

/** The cursor `encodeLibraryCursor` wrote, or null for anything else. */
export function decodeLibraryCursor(text: string): LibraryCursor | null {
  const [at, id, ...rest] = Buffer.from(text, 'base64url').toString('utf8').split('|');
  if (at === undefined || id === undefined || rest.length > 0 || !GUID.test(id)) return null;
  const lastChangedAt = new Date(at);
  if (Number.isNaN(lastChangedAt.getTime()) || lastChangedAt.toISOString() !== at) return null;
  return { lastChangedAt, id };
}
