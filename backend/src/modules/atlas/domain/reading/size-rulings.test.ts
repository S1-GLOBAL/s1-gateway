import { describe, expect, it } from 'vitest';
import { applyProposal } from '../suggestions/apply-proposal.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { readSize } from './size-rulings.js';

const dictionary = s2Dictionary();
const mm = (value: string) => ({ value, unit: 'mm' });

describe('readSize, by #28 rulings', () => {
  it.each([
    ['R1', 'cup 90', 'CUP', { shape: 'RD', topDiameter: mm('90') }],
    ['R1', 'bowl lid 150mm', 'BLD', { shape: 'RD', topDiameter: mm('150') }],
    ['R1', 'portion cup lid ø62', 'PCL', { shape: 'RD', topDiameter: mm('62') }],
    ['R1', 'cup lid 9 cm', 'CLD', { shape: 'RD', topDiameter: { value: '9', unit: 'cm' } }],
    ['R1b', 'cup 80 dia x 95', 'CUP', { shape: 'RD', topDiameter: mm('80'), height: mm('95') }],
    ['R2', 'bowl 150 dia x 120 x 60', 'BWL', { shape: 'RD', topDiameter: mm('150'), bottomDiameter: mm('120'), height: mm('60') }],
    ['R3', 'pouch 140 x 210 x 80', 'SUP', { width: mm('140'), height: mm('210'), gusset: mm('80') }],
    ['R5', 'bag 250 x 120 x 300', 'BAG', { width: mm('250'), gusset: mm('120'), height: mm('300') }],
    ['R6', 'takeout box 200 x 150 x 60 mm', 'TKB', { length: mm('200'), width: mm('150'), height: mm('60') }],
    ['R6', 'tray 200 x 150 x 60', 'TRY', { shape: 'RC', length: mm('200'), width: mm('150'), height: mm('60') }],
    ['R6', 'clamshell 200 x 150 x 80', 'HCT', { shape: 'RC', length: mm('200'), width: mm('150'), height: mm('80') }],
  ])('%s reads "%s" on %s', (ruling, text, productType, facts) => {
    expect(readSize(text, productType, dictionary)).toMatchObject({ ruling, facts });
  });

  it.each([
    ['a bare number on a bag, which no single-number ruling covers', 'bag 90', 'BAG'],
    ['two bare numbers', 'cup 90 80', 'CUP'],
    ['a number with another unit', 'cup 300gsm', 'CUP'],
    ['a number before a word', 'cup 12 pcs', 'CUP'],
    ['two numbers on a takeout box', 'takeout box 200 x 150', 'TKB'],
    ['R2 with a bottom wider than the top', 'bowl 120 dia x 150 x 60', 'BWL'],
    ['a Dia by height on a bag, which R1b does not cover', 'bag 94 dia x 115', 'BAG'],
    ['R3 with the gusset not the smallest', 'pouch 80 x 210 x 140', 'SUP'],
    ['R5 with the gusset not the smallest', 'bag 120 x 250 x 300', 'BAG'],
  ])('reads nothing for %s', (_case, text, productType) => {
    expect(readSize(text, productType, dictionary)).toBeNull();
  });
});

describe('readSize, a fraction (#58)', () => {
  const inches = (value: string) => ({ value, unit: 'in' });

  it.each([
    ['R6', 'box 20-1/8 x 13 x 10', 'FCB', { length: inches('20.125'), width: inches('13'), height: inches('10') }],
    ['R6', 'box 6 1/2 x 4 x 2', 'FCB', { length: inches('6.5'), width: inches('4'), height: inches('2') }],
    ['R6', 'tray 10½ x 8¼ x 1¾', 'TRY', { shape: 'RC', length: inches('10.5'), width: inches('8.25'), height: inches('1.75') }],
    ['R6', 'box 1/2 x 3/4 x 5/64', 'FCB', { length: inches('0.5'), width: inches('0.75'), height: inches('0.078125') }],
    ['R1', 'cup 3 1/2', 'CUP', { shape: 'RD', topDiameter: inches('3.5') }],
    ['R6', 'box 20 1/8 x 13 x 10 mm', 'FCB', { length: { value: '20.125', unit: 'mm' }, width: { value: '13', unit: 'mm' } }],
  ])('%s reads %s on %s', (ruling, text, productType, facts) => {
    expect(readSize(text, productType, dictionary)).toMatchObject({ ruling, facts });
  });

  it('reads no part of a fraction as a number of its own', () => {
    expect(readSize('box 20-1/8 x 13 x 10', 'FCB', dictionary)?.facts.length).not.toEqual({ value: '8', unit: 'mm' });
    expect(readSize('cup 1/3', 'CUP', dictionary)).toBeNull();
  });
});

describe('readSize after approved changes (ADR 0031)', () => {
  const rename = (from: typeof dictionary, slot: 'productType' | 'shape', code: string, newCode: string, number: number) =>
    applyProposal(from, { slot, code }, { kind: 'edit', newCode, meaning: null, searchWords: null }, { number, at: new Date('2026-10-27T10:00:00.000Z') });

  it("reads a renamed product type under its ruling, naming the shape in its live letters", () => {
    const renamed = rename(rename(dictionary, 'productType', 'TRY', 'TRX', 1), 'shape', 'RC', 'RX', 2);
    expect(readSize('tray 200 x 150 x 60', 'TRX', renamed)).toMatchObject({ ruling: 'R6', facts: { shape: 'RX', length: mm('200') } });
    expect(readSize('tray 200 x 150 x 60', 'TRY', renamed)).toBeNull();
  });
});
