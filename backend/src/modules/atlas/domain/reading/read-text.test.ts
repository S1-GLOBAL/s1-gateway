import { describe, expect, it } from 'vitest';
import type { DictionarySlotKey } from '../slots.js';
import { applyProposal } from '../suggestions/apply-proposal.js';
import type { Proposal } from '../suggestions/proposal.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { readText } from './read-text.js';
import { CAPACITY_UNIT, COATING, COLOUR_CLARITY, LID_OPENING, MATERIAL, PRINT, PRODUCT_TYPE, PROFILE, SHAPE, WALL } from '../options.js';

const dictionary = s2Dictionary();
const read = (text: string, productType?: string) => readText(text, dictionary, productType);

describe('readText', () => {
  it('reads a bowl, bagasse and 14 oz, and ignores the rest', () => {
    const reading = read('14oz Bagasse Bowl for Cava');
    expect(reading.facts).toEqual({ productType: PRODUCT_TYPE.bowl, material: MATERIAL.bagasse, capacity: { unit: CAPACITY_UNIT.ounces, value: '14' } });
    expect(reading.ignored).toEqual(['for', 'Cava']);
    expect(reading.read.map((fact) => [fact.key, fact.words])).toEqual([
      ['productType', 'Bowl'],
      ['material', 'Bagasse'],
      ['capacity', '14oz'],
    ]);
    expect(reading.conflicts).toEqual([]);
  });

  it('reads a glove of nitrile, powder-free or powdered, by the words shipped with them (plan 0012)', () => {
    for (const text of ['Nitrile glove, powder free', 'nitrile gloves powder-free']) {
      expect(read(text).facts).toEqual({ productType: PRODUCT_TYPE.glove, material: MATERIAL.nitrile, coating: COATING.powderFree });
    }
    expect(read('latex glove powdered').facts).toEqual({ productType: PRODUCT_TYPE.glove, material: MATERIAL.latex, coating: COATING.powdered });
    expect(read('PVC glove').facts).toMatchObject({ productType: PRODUCT_TYPE.glove, material: MATERIAL.vinyl });
    expect(read('kraft coffee sleeve 12oz').facts).toMatchObject({ productType: PRODUCT_TYPE.cupSleeve, material: MATERIAL.kraft });
  });

  it('reads a cup rim of 90 mm under R1, and its round shape', () => {
    const reading = read('Cup 90mm');
    expect(reading.facts).toEqual({ productType: PRODUCT_TYPE.cup, shape: SHAPE.round, topDiameter: { value: '90', unit: 'mm' } });
    expect(reading.read.find((fact) => fact.key === 'topDiameter')).toMatchObject({ words: '90mm', ruling: 'R1' });
  });

  it('leaves out a fact the text gives twice, and reports both as written', () => {
    const reading = read('clear PET and PP lid');
    expect(reading.facts).not.toHaveProperty('material');
    expect(reading.conflicts).toEqual([{ key: 'material', found: ['PET', 'PP'], values: [MATERIAL.pet, MATERIAL.pp] }]);
  });

  it('reads text glued with punctuation and in capitals', () => {
    expect(read('14OZ,Bagasse-Bowl').facts).toEqual(read('14oz bagasse bowl').facts);
  });

  it('leaves a print colour range unknown', () => {
    const reading = read('22oz White Single Wall Paper Cold Cup (2-3 color print)');
    expect(reading.facts).toEqual({
      productType: PRODUCT_TYPE.cup,
      material: MATERIAL.paper,
      colourClarity: COLOUR_CLARITY.white,
      wall: WALL.singleWall,
      capacity: { unit: CAPACITY_UNIT.ounces, value: '22' },
    });
    expect(reading.conflicts).toEqual([{ key: 'print', found: ['2 colour', '3 colour'], values: [PRINT.twoColours, PRINT.threeColours] }]);
    expect(reading.ignored).toEqual(['Cold']);
  });

  it('reads a product type inside a longer name as the longer one', () => {
    expect(read('Bowl Lid').facts.productType).toBe(PRODUCT_TYPE.bowlLid);
    expect(read('lid with straw hole').facts).toEqual({ productType: PRODUCT_TYPE.cupLid, lidOpening: LID_OPENING.strawHole });
  });

  it('reads a material named inside a product type', () => {
    expect(read('12oz double-wall paper cup, 2 colour print').facts).toEqual({
      productType: PRODUCT_TYPE.cup,
      material: MATERIAL.paper,
      capacity: { unit: CAPACITY_UNIT.ounces, value: '12' },
      wall: WALL.doubleWall,
      print: PRINT.twoColours,
    });
  });

  it('reads kraft as a brown colour only on paper', () => {
    expect(read('kraft takeout box').facts.colourClarity).toBe(COLOUR_CLARITY.brown);
    expect(read('kraft PP container').facts).not.toHaveProperty('colourClarity');
  });

  it('reads nothing from a number with no unit and no product type', () => {
    const reading = read('Cava order 12');
    expect(reading.facts).toEqual({});
    expect(reading.ignored).toEqual(['Cava', 'order', '12']);
  });

  it('reads a size by the product type it is given, which wins over the text', () => {
    const reading = read('PET lid 90', PRODUCT_TYPE.portionCupLid);
    expect(reading.facts).toMatchObject({ productType: PRODUCT_TYPE.portionCupLid, material: MATERIAL.pet, topDiameter: { value: '90', unit: 'mm' } });
  });
});

describe('readText, #58', () => {
  const inches = (value: string) => ({ value, unit: 'in' });
  const mm = (value: string) => ({ value, unit: 'mm' });

  it.each(['Box 20-1/8 x 13 x 10', 'Box 20 1/8 x 13 x 10', 'Box 20⅛ x 13 x 10'])('reads a size with a fraction, %s, in inches', (text) => {
    expect(read(text).facts).toEqual({ productType: PRODUCT_TYPE.foldingCarton, length: inches('20.125'), width: inches('13'), height: inches('10') });
  });

  it('still reads three numbers with no unit in millimetres, by R6', () => {
    expect(read('10 x 8 x 6 shipper box').facts).toMatchObject({ length: mm('10'), width: mm('8'), height: mm('6') });
  });

  it.each([
    ['8-16oz lid', ['8oz', '16oz']],
    ['16/24 oz lid', ['16 oz', '24 oz']],
    ['8oz-16oz lid', ['8oz', '16oz']],
    ['250 to 500ml lid', ['250ml', '500ml']],
  ])('leaves the capacity of a range, %s, not known, and reads neither end as a size', (text, found) => {
    const reading = read(text);
    expect(reading.facts).toEqual({ productType: PRODUCT_TYPE.cupLid });
    expect(reading.conflicts).toEqual([expect.objectContaining({ key: 'capacity', found })]);
    expect(reading.ignored).toEqual([]);
  });

  it.each([
    ['Paper cup 3-color', '3 colours', PRINT.threeColours],
    ['Paper cup 3 colours', '3 colours', PRINT.threeColours],
    ['Paper cup 3 color printing', '3 colours', PRINT.threeColours],
    ['Paper cup with 3-color print', '3 colours', PRINT.threeColours],
    ['Paper cup full colour printing', 'full colour', PRINT.fullColour],
  ])('reads %s as print in %s, and not as a size', (text, _colours, print) => {
    const reading = read(text);
    expect(reading.facts).toEqual({ productType: PRODUCT_TYPE.cup, material: MATERIAL.paper, print });
  });
});

describe('readText after approved changes', () => {
  const STAMP = { number: 1, at: new Date('2026-10-27T10:00:00.000Z') };
  const changed = (slot: DictionarySlotKey, code: string, proposal: Proposal) =>
    applyProposal(dictionary, { slot, code }, proposal, STAMP);
  const reworded = (slot: DictionarySlotKey, code: string, meaning: string) =>
    changed(slot, code, { kind: 'edit', newCode: null, meaning, searchWords: null });
  const withWords = (slot: DictionarySlotKey, code: string, searchWords: string[]) =>
    changed(slot, code, { kind: 'edit', newCode: null, meaning: null, searchWords });

  it('reads a keyword as its option by number, whatever the option is worded now (ADR 0033)', () => {
    expect(readText('12oz double wall paper cup', reworded('wall', WALL.doubleWall, 'Double-wall')).facts.wall).toBe(WALL.doubleWall);
  });

  it('reads a word-list word as its material by number, whatever the material is worded now', () => {
    expect(readText('14oz Bagasse Bowl', reworded('material', MATERIAL.bagasse, 'Molded fibre, sugarcane')).facts.material).toBe(MATERIAL.bagasse);
  });

  it("leaves a deleted option's keyword not known, and reports its words as ignored", () => {
    const reading = readText('half dome bowl lid', changed('profile', PROFILE.halfDome, { kind: 'delete', replacement: null }));
    expect(reading.facts).not.toHaveProperty('profile');
    expect(reading.ignored).toEqual(['half', 'dome']);
  });

  it("reads no amount under a deleted unit, and the other units' as before", () => {
    const withoutMl = changed('capacity', CAPACITY_UNIT.millilitres, { kind: 'delete', replacement: null });
    expect(readText('500ml paper cup', withoutMl).facts).not.toHaveProperty('capacity');
    expect(readText('14oz paper cup', withoutMl).facts.capacity).toEqual({ unit: CAPACITY_UNIT.ounces, value: '14' });
  });

  it("reads a reworded product type's size under its rulings", () => {
    expect(readText('Cup 90mm', reworded('productType', PRODUCT_TYPE.cup, 'Drinking cup')).facts).toEqual({
      productType: PRODUCT_TYPE.cup,
      shape: SHAPE.round,
      topDiameter: { value: '90', unit: 'mm' },
    });
  });

  it('reads an approved search word as its option, and not before it is approved', () => {
    expect(readText('sugarcane fibre bowl', withWords('material', MATERIAL.bagasse, ['sugarcane fibre'])).facts.material).toBe(MATERIAL.bagasse);
    expect(read('sugarcane fibre bowl').facts).not.toHaveProperty('material');
  });

  it('reads an approved search word in any field, and one for a unit after its number', () => {
    expect(readText('oblong tray', withWords('shape', SHAPE.rectangular, ['oblong'])).facts.shape).toBe(SHAPE.rectangular);
    expect(readText('12 fluid ounces paper cup', withWords('capacity', CAPACITY_UNIT.ounces, ['fluid ounces'])).facts.capacity).toEqual({
      unit: CAPACITY_UNIT.ounces,
      value: '12',
    });
  });
});
