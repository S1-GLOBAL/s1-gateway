import { describe, expect, it } from 'vitest';
import { SLOT_NAMES } from './atlas';
import { byNumber, CODE_LETTERS, codeLetter, valueCode } from './code-letters';

describe('CODE_LETTERS', () => {
  it('gives every slot but the variant its own letter, A to X in slot order', () => {
    const letters = SLOT_NAMES.map((slot) => codeLetter(slot.key));
    expect(letters).toEqual([...'ABCDEFGHIJKLMNOPQRSTUVWX', undefined]);
    expect(new Set(Object.values(CODE_LETTERS)).size).toBe(24);
  });
});

describe('valueCode', () => {
  it("writes a value as its list's letter and its number", () => {
    expect(valueCode('material', 17)).toBe('B17');
    expect(valueCode('productType', 1)).toBe('A1');
    expect(valueCode('window', 2)).toBe('X2');
  });

  it('writes a capacity unit as the digit after G', () => {
    expect(valueCode('capacity', 1)).toBe('G1');
    expect(valueCode('capacity', 5)).toBe('G5');
  });
});

describe('byNumber', () => {
  it('orders values by their number, not their text, and leaves the list given alone', () => {
    const values = [{ number: 10 }, { number: 2 }, { number: 1 }];
    expect(byNumber(values).map((value) => value.number)).toEqual([1, 2, 10]);
    expect(values.map((value) => value.number)).toEqual([10, 2, 1]);
  });
});
