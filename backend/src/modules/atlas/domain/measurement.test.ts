import { describe, expect, it } from 'vitest';
import { fraction, multiply, readDecimal, roundHalfUp, type Fraction } from './measurement.js';
import { MEASURES } from './slots.js';

function read(text: string): Fraction {
  const reading = readDecimal(text);
  if (!reading.ok) throw new Error(`expected ${text} to read`);
  return reading.value;
}

function steps(text: string, slot: keyof typeof MEASURES, unit: string): bigint {
  const factor = MEASURES[slot].units[unit];
  if (!factor) throw new Error(`no unit ${unit}`);
  return roundHalfUp(multiply(read(text), factor));
}

describe('readDecimal', () => {
  it.each([
    ['90', 90n, 1n],
    ['1.375', 1375n, 1000n],
    ['0.000001', 1n, 1_000_000n],
    [' 4.25 ', 425n, 100n],
  ])('reads %s exactly', (text, numerator, denominator) => {
    expect(read(text)).toEqual(fraction(numerator, denominator));
  });

  it.each(['', '-5', '+5', '1e3', '1,5', '.5', '5.', '9O', 'abc'])('refuses %j as not a number', (text) => {
    expect(readDecimal(text)).toEqual({ ok: false, reason: 'not-a-number' });
  });

  it('refuses more than 6 decimal places', () => {
    expect(readDecimal('1.1234567')).toEqual({ ok: false, reason: 'too-many-decimals' });
  });
});

describe('converting to slot steps, rounding half up', () => {
  it.each([
    ['1.375', 'topDiameter', 'in', 35n],
    ['4.25', 'height', 'in', 108n],
    ['90', 'topDiameter', 'mm', 90n],
    ['9', 'topDiameter', 'cm', 90n],
    ['34.5', 'height', 'mm', 35n],
    ['34.4999', 'height', 'mm', 34n],
    ['3.3', 'unitWeight', 'g', 33n],
    ['4', 'unitWeight', 'g', 40n],
    ['0.04', 'unitWeight', 'g', 0n],
    ['0.05', 'unitWeight', 'g', 1n],
    ['250', 'basisWeight', 'gsm', 250n],
    ['60', 'thickness', 'um', 60n],
  ] as const)('%s %s in %s is %s steps', (text, slot, unit, expected) => {
    expect(steps(text, slot, unit)).toBe(expected);
  });
});
