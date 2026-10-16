import { describe, expect, it } from 'vitest';
import { toSlotText } from './to-slot-text';

describe('toSlotText', () => {
  it.each([
    ['topDiameter', '90', '0090'],
    ['topDiameter', '0090', '0090'],
    ['topDiameter', '9999', '9999'],
    ['height', '1', '0001'],
    ['basisWeight', '45', '045'],
    ['thickness', '7', '007'],
    ['unitWeight', '3.3', '0033'],
    ['unitWeight', '4', '0040'],
    ['unitWeight', '999.9', '9999'],
    ['unitWeight', '0.1', '0001'],
    ['capacity', 'Z6', 'Z0006'],
    ['capacity', 'M500', 'M0500'],
  ] as const)('writes %s %j as %j', (key, text, expected) => {
    expect(toSlotText(key, text)).toBe(expected);
  });

  it.each([
    ['height', '12a'],
    ['height', '12345'],
    ['height', '1.5'],
    ['unitWeight', '3.33'],
    ['unitWeight', '3.'],
    ['capacity', 'Z'],
    ['capacity', '6'],
    ['shape', 'RD'],
  ] as const)('leaves %s %j as typed, for the server to name', (key, text) => {
    expect(toSlotText(key, text)).toBe(text);
  });
});
