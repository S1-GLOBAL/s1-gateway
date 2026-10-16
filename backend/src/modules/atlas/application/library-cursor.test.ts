import { describe, expect, it } from 'vitest';
import { decodeLibraryCursor, encodeLibraryCursor } from './library-cursor.js';

const CURSOR = { lastChangedAt: new Date('2026-10-17T08:00:00.000Z'), id: '00000000-0000-4000-8000-000000000021' };

describe('the library cursor', () => {
  it('reads back what it wrote', () => {
    expect(decodeLibraryCursor(encodeLibraryCursor(CURSOR))).toEqual(CURSOR);
  });

  it('is safe in a query string', () => {
    expect(encodeLibraryCursor(CURSOR)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['garbage', 'not-a-cursor'],
    ['no id', Buffer.from('2026-10-17T08:00:00.000Z', 'utf8').toString('base64url')],
    ['a bad date', Buffer.from('yesterday|00000000-0000-4000-8000-000000000021', 'utf8').toString('base64url')],
    ['a bad id', Buffer.from('2026-10-17T08:00:00.000Z|21', 'utf8').toString('base64url')],
    ['a third part', Buffer.from(`2026-10-17T08:00:00.000Z|${CURSOR.id}|x`, 'utf8').toString('base64url')],
  ])('refuses %s', (_name, text) => {
    expect(decodeLibraryCursor(text)).toBeNull();
  });
});
