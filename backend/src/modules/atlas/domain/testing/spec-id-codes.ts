import { SLOTS, type SlotKey } from '../slots.js';

/*
 * Codes for tests (ADR 0025). The illustrative bowl lid is the specification's
 * own example; every other value in the tests is invented.
 */

/** The illustrative bowl lid in the short form. */
export const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';

/** The illustrative bowl lid as S2 wrote it before ADR 0025. */
export const ILLUSTRATIVE_LONG = 'S2.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX.00.XX.X.XX.XX.XX.XX.XX';

/** The illustrative bowl lid as S1 wrote it. */
export const ILLUSTRATIVE_S1 = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';

/** `code` with one slot's text replaced: `withSlot(ILLUSTRATIVE, 'height', '0062')`. */
export function withSlot(code: string, key: SlotKey, raw: string): string {
  const parts = code.split('.');
  parts[SLOTS.findIndex((slot) => slot.key === key)] = raw;
  return parts.join('.');
}
