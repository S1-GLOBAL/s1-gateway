import { DOES_NOT_APPLY, NOT_KNOWN, SLOT_COUNT, SLOTS } from './slots.js';

/** An S1 code (ADR 0019): 18 slots, 74 characters. Every code given out before S2. */
export const S1_LENGTH = 74;
export const S1_PARTS = 18;

/**
 * The eight slots S2 added (wall, print, compartments, plies, lid opening,
 * handle, wrap, window), as they read for each product type S1 had: not known
 * where S2 0.1.0 applies the slot to it, `X` where it doesn't (ADR 0024),
 * written in the long form. S1 had no other product type, so this table
 * converts every S1 code.
 */
export const S1_ADDED_SLOTS: Readonly<Record<string, string>> = {
  BLD: 'XX.00.XX.X.XX.XX.XX.XX',
  CLD: 'XX.00.XX.X.00.XX.XX.XX',
  BWL: '00.00.00.X.XX.XX.XX.XX',
  SUP: 'XX.00.XX.X.XX.XX.XX.00',
};

/** The tag a long code starts with: every code given out between S2 and ADR 0025. */
const LONG_TAG = 'S2.';

/** A part of a long code, in the short form: all `0` is `Y`, all `X` is `X`, a value is kept. */
export function shortPart(part: string): string {
  if (/^0+$/.test(part)) return NOT_KNOWN;
  if (/^X+$/.test(part)) return DOES_NOT_APPLY;
  return part;
}

/**
 * The long S2 code for an S1 code, with the same facts: slots 2–17 unchanged,
 * the eight added slots, then the variant. Null for anything that is not an
 * S1 code of one of S1's product types.
 */
export function fromS1(code: string): string | null {
  if (code.length !== S1_LENGTH || !code.startsWith('S1.')) return null;
  const parts = code.split('.');
  if (parts.length !== S1_PARTS) return null;
  const added = S1_ADDED_SLOTS[parts[1] ?? ''];
  if (added === undefined) return null;
  return `S2${code.slice(2, 71)}.${added}.${parts[S1_PARTS - 1]}`;
}

/**
 * The short code for a code given out before ADR 0025, with the same facts:
 * an S1 code, or one starting `S2.`, whose tag goes and whose markers become
 * one letter. Null for anything that starts with neither, such as a short code.
 */
export function toShort(code: string): string | null {
  const long = code.startsWith('S1.') ? fromS1(code) : code;
  if (long === null || !long.startsWith(LONG_TAG)) return null;
  return long.slice(LONG_TAG.length).split('.').map(shortPart).join('.');
}

/**
 * Any code text in the short form: converted when it was given out before,
 * and any marker written wide (`0000`, `XX`) as its one letter.
 */
export function shortForm(code: string): string {
  return (toShort(code) ?? code).split('.').map(shortPart).join('.');
}

/**
 * The long code a short one was written as before ADR 0025: `S2.`, then each
 * marker filled to its slot's width. Null for anything that is not 25 parts.
 */
export function toLong(code: string): string | null {
  const parts = code.split('.');
  if (parts.length !== SLOT_COUNT) return null;
  const filled = parts.map((part, index) => {
    const width = SLOTS[index]?.width ?? 1;
    if (part === NOT_KNOWN) return '0'.repeat(width);
    if (part === DOES_NOT_APPLY) return 'X'.repeat(width);
    return part;
  });
  return `${LONG_TAG}${filled.join('.')}`;
}

/** Both forms a code may be stored in: itself, and the long form an older API wrote during a deploy. */
export function storedForms(code: string): string[] {
  const long = toLong(code);
  return long === null ? [code] : [code, long];
}
