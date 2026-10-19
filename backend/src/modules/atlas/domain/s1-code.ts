import { FORMAT_VERSION, SLOT_COUNT, SPEC_ID_LENGTH } from './slots.js';

/** An S1 code (ADR 0019): 18 slots, 74 characters. Every code given out before S2. */
export const S1_LENGTH = 74;
export const S1_PARTS = 18;

/**
 * The eight slots S2 added (wall, print, compartments, plies, lid opening,
 * handle, wrap, window), as they read for each product type S1 had: `0` where
 * S2 0.1.0 applies the slot to it, `X` where it doesn't (ADR 0024). S1 had no
 * other product type, so this table converts every S1 code.
 */
export const S1_ADDED_SLOTS: Readonly<Record<string, string>> = {
  BLD: 'XX.00.XX.X.XX.XX.XX.XX',
  CLD: 'XX.00.XX.X.00.XX.XX.XX',
  BWL: '00.00.00.X.XX.XX.XX.XX',
  SUP: 'XX.00.XX.X.XX.XX.XX.00',
};

/** Slots 1–17 keep their positions: characters 3–71 are the same in both formats. */
const SHARED_START = 2;
const SHARED_END = 71;

/**
 * The S2 code for an S1 code, with the same facts: `S2`, slots 2–17
 * unchanged, the eight added slots, then the variant. Null for anything that
 * is not an S1 code of one of S1's product types.
 */
export function fromS1(code: string): string | null {
  if (code.length !== S1_LENGTH || !code.startsWith('S1.')) return null;
  const parts = code.split('.');
  if (parts.length !== S1_PARTS) return null;
  const added = S1_ADDED_SLOTS[parts[1] ?? ''];
  if (added === undefined) return null;
  return `${FORMAT_VERSION}${code.slice(SHARED_START, SHARED_END)}.${added}.${parts[S1_PARTS - 1]}`;
}

/**
 * The S1 code an S2 code was converted from, when there is one: its product
 * type is one S1 had and its added slots read exactly as `fromS1` writes them.
 * Lookups use it to find a code stored in S1 form.
 */
export function toS1(code: string): string | null {
  if (code.length !== SPEC_ID_LENGTH || !code.startsWith(`${FORMAT_VERSION}.`)) return null;
  const parts = code.split('.');
  if (parts.length !== SLOT_COUNT) return null;
  const added = S1_ADDED_SLOTS[parts[1] ?? ''];
  if (added === undefined || parts.slice(S1_PARTS - 1, SLOT_COUNT - 1).join('.') !== added) return null;
  return `S1${code.slice(SHARED_START, SHARED_END)}.${parts[SLOT_COUNT - 1]}`;
}

/** Both forms a code may be stored in: itself, and its S1 form when it has one. */
export function storedForms(code: string): string[] {
  const s1 = toS1(code);
  return s1 === null ? [code] : [code, s1];
}
