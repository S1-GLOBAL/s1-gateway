import { describe, expect, it } from 'vitest';
import { readSize } from './size-rulings.js';

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
    expect(readSize(text, productType)).toMatchObject({ ruling, facts });
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
    expect(readSize(text, productType)).toBeNull();
  });
});
