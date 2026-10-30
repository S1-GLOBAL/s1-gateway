import { describe, expect, it } from 'vitest';
import { applyProposal } from '../suggestions/apply-proposal.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { readSize } from './size-rulings.js';
import { PRODUCT_TYPE, SHAPE } from '../options.js';

const dictionary = s2Dictionary();
const mm = (value: string) => ({ value, unit: 'mm' });

describe('readSize, by #28 rulings', () => {
  it.each([
    ['R1', 'cup 90', PRODUCT_TYPE.cup, { shape: SHAPE.round, topDiameter: mm('90') }],
    ['R1', 'bowl lid 150mm', PRODUCT_TYPE.bowlLid, { shape: SHAPE.round, topDiameter: mm('150') }],
    ['R1', 'portion cup lid ø62', PRODUCT_TYPE.portionCupLid, { shape: SHAPE.round, topDiameter: mm('62') }],
    ['R1', 'cup lid 9 cm', PRODUCT_TYPE.cupLid, { shape: SHAPE.round, topDiameter: { value: '9', unit: 'cm' } }],
    ['R1b', 'cup 80 dia x 95', PRODUCT_TYPE.cup, { shape: SHAPE.round, topDiameter: mm('80'), height: mm('95') }],
    ['R2', 'bowl 150 dia x 120 x 60', PRODUCT_TYPE.bowl, { shape: SHAPE.round, topDiameter: mm('150'), bottomDiameter: mm('120'), height: mm('60') }],
    ['R3', 'pouch 140 x 210 x 80', PRODUCT_TYPE.standUpPouch, { width: mm('140'), height: mm('210'), gusset: mm('80') }],
    ['R5', 'bag 250 x 120 x 300', PRODUCT_TYPE.bag, { width: mm('250'), gusset: mm('120'), height: mm('300') }],
    ['R6', 'takeout box 200 x 150 x 60 mm', PRODUCT_TYPE.takeoutBox, { length: mm('200'), width: mm('150'), height: mm('60') }],
    ['R6', 'tray 200 x 150 x 60', PRODUCT_TYPE.tray, { shape: SHAPE.rectangular, length: mm('200'), width: mm('150'), height: mm('60') }],
    ['R6', 'clamshell 200 x 150 x 80', PRODUCT_TYPE.hingedContainer, { shape: SHAPE.rectangular, length: mm('200'), width: mm('150'), height: mm('80') }],
    ['R6', 'fry carton 100 x 140 x 50', PRODUCT_TYPE.fryCarton, { length: mm('100'), width: mm('140'), height: mm('50') }],
    ['R6', 'container 280 x 200 x 60', PRODUCT_TYPE.container, { length: mm('280'), width: mm('200'), height: mm('60') }],
    ['R6', 'plate 250 x 190 x 25', PRODUCT_TYPE.plate, { length: mm('250'), width: mm('190'), height: mm('25') }],
    ['R6', 'container lid 240 x 190 x 15', PRODUCT_TYPE.containerLid, { length: mm('240'), width: mm('190'), height: mm('15') }],
    ['R6', 'cup carrier 215 x 215 x 50', PRODUCT_TYPE.cupCarrier, { length: mm('215'), width: mm('215'), height: mm('50') }],
    ['R1', 'cup 98mm diameter plain', PRODUCT_TYPE.cup, { shape: SHAPE.round, topDiameter: mm('98') }],
    ['R1', 'cup 95 dia, 0.5', PRODUCT_TYPE.cup, { shape: SHAPE.round, topDiameter: mm('95') }],
    ['R1', 'cup φ80', PRODUCT_TYPE.cup, { shape: SHAPE.round, topDiameter: mm('80') }],
  ])('%s reads "%s" on %s', (ruling, text, productType, facts) => {
    expect(readSize(text, productType, dictionary)).toMatchObject({ ruling, facts });
  });

  it.each([
    ['a bare number on a bag, which no single-number ruling covers', 'bag 90', PRODUCT_TYPE.bag],
    ['two bare numbers', 'cup 90 80', PRODUCT_TYPE.cup],
    ['a number with another unit', 'cup 300gsm', PRODUCT_TYPE.cup],
    ['a number before a word', 'cup 12 pcs', PRODUCT_TYPE.cup],
    ['two numbers on a takeout box', 'takeout box 200 x 150', PRODUCT_TYPE.takeoutBox],
    ['R2 with a bottom wider than the top', 'bowl 120 dia x 150 x 60', PRODUCT_TYPE.bowl],
    ['a Dia by height on a bag, which R1b does not cover', 'bag 94 dia x 115', PRODUCT_TYPE.bag],
    ['R3 with the gusset not the smallest', 'pouch 80 x 210 x 140', PRODUCT_TYPE.standUpPouch],
    ['R5 with the gusset not the smallest', 'bag 120 x 250 x 300', PRODUCT_TYPE.bag],
    ['a weight with decimals, whose whole part is no rim', 'portion cup 1.9g', PRODUCT_TYPE.portionCup],
    ['a capacity with decimals', 'portion cup 3.25oz', PRODUCT_TYPE.portionCup],
    ['a bare number wider than any rim', 'paper bowl 500', PRODUCT_TYPE.bowl],
    ['a rim over 300 mm in another unit', 'bowl lid 31 cm', PRODUCT_TYPE.bowlLid],
    ['a rim narrower than any cup', 'cup 20', PRODUCT_TYPE.cup],
    ['a model code', 'bowl deli-34', PRODUCT_TYPE.bowl],
    ['the second of two numbers', 'cup 90 x 110', PRODUCT_TYPE.cup],
    ['two sizes written with a slash, not a fraction', 'bowl lid 24/32', PRODUCT_TYPE.bowlLid],
  ])('reads nothing for %s', (_case, text, productType) => {
    expect(readSize(text, productType, dictionary)).toBeNull();
  });
});

describe('readSize, a fraction (#58)', () => {
  const inches = (value: string) => ({ value, unit: 'in' });

  it.each([
    ['R6', 'box 20-1/8 x 13 x 10', PRODUCT_TYPE.foldingCarton, { length: inches('20.125'), width: inches('13'), height: inches('10') }],
    ['R6', 'box 6 1/2 x 4 x 2', PRODUCT_TYPE.foldingCarton, { length: inches('6.5'), width: inches('4'), height: inches('2') }],
    ['R6', 'tray 10½ x 8¼ x 1¾', PRODUCT_TYPE.tray, { shape: SHAPE.rectangular, length: inches('10.5'), width: inches('8.25'), height: inches('1.75') }],
    ['R6', 'box 1/2 x 3/4 x 5/64', PRODUCT_TYPE.foldingCarton, { length: inches('0.5'), width: inches('0.75'), height: inches('0.078125') }],
    ['R1', 'cup 3 1/2', PRODUCT_TYPE.cup, { shape: SHAPE.round, topDiameter: inches('3.5') }],
    ['R6', 'box 20 1/8 x 13 x 10 mm', PRODUCT_TYPE.foldingCarton, { length: { value: '20.125', unit: 'mm' }, width: { value: '13', unit: 'mm' } }],
  ])('%s reads %s on %s', (ruling, text, productType, facts) => {
    expect(readSize(text, productType, dictionary)).toMatchObject({ ruling, facts });
  });

  it('reads the size with its unit written over the same size with none, and the other as a repeat', () => {
    expect(readSize('bag 10 x 7 x 12, 10 x 7 x 12 in', PRODUCT_TYPE.bag, dictionary)).toMatchObject({
      ruling: 'R5',
      words: '10 x 7 x 12 in',
      facts: { width: inches('10'), gusset: inches('7'), height: inches('12') },
      repeats: ['10 x 7 x 12'],
    });
  });

  it('reads no part of a fraction as a number of its own', () => {
    expect(readSize('box 20-1/8 x 13 x 10', PRODUCT_TYPE.foldingCarton, dictionary)?.facts.length).not.toEqual({ value: '8', unit: 'mm' });
    expect(readSize('cup 1/3', PRODUCT_TYPE.cup, dictionary)).toBeNull();
  });
});

describe('readSize after approved changes (ADR 0031, ADR 0033)', () => {
  const reword = (from: typeof dictionary, slot: 'productType' | 'shape', code: string, meaning: string, number: number) =>
    applyProposal(from, { slot, code }, { kind: 'edit', newCode: null, meaning, searchWords: null }, { number, at: new Date('2026-10-27T10:00:00.000Z') });

  it('reads a product type under its ruling by its number, whatever its wording, and names the shape by its number', () => {
    const reworded = reword(reword(dictionary, 'productType', PRODUCT_TYPE.tray, 'Serving tray', 1), 'shape', SHAPE.rectangular, 'Oblong', 2);
    expect(readSize('tray 200 x 150 x 60', PRODUCT_TYPE.tray, reworded)).toMatchObject({
      ruling: 'R6',
      facts: { shape: SHAPE.rectangular, length: mm('200') },
    });
  });
});
