import { describe, expect, it } from 'vitest';
import type { DictionarySlotKey } from '../slots.js';
import { applyProposal } from '../suggestions/apply-proposal.js';
import type { Proposal } from '../suggestions/proposal.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { readText } from './read-text.js';

const dictionary = s2Dictionary();
const read = (text: string, productType?: string) => readText(text, dictionary, productType);

describe('readText', () => {
  it('reads a bowl, bagasse and 14 oz, and ignores the rest', () => {
    const reading = read('14oz Bagasse Bowl for Cava');
    expect(reading.facts).toEqual({ productType: 'BWL', material: 'CBG', capacity: { unit: 'Z', value: '14' } });
    expect(reading.ignored).toEqual(['for', 'Cava']);
    expect(reading.read.map((fact) => [fact.key, fact.words])).toEqual([
      ['productType', 'Bowl'],
      ['material', 'Bagasse'],
      ['capacity', '14oz'],
    ]);
    expect(reading.conflicts).toEqual([]);
  });

  it('reads a cup rim of 90 mm under R1, and its round shape', () => {
    const reading = read('Cup 90mm');
    expect(reading.facts).toEqual({ productType: 'CUP', shape: 'RD', topDiameter: { value: '90', unit: 'mm' } });
    expect(reading.read.find((fact) => fact.key === 'topDiameter')).toMatchObject({ words: '90mm', ruling: 'R1' });
  });

  it('leaves out a fact the text gives twice, and reports both as written', () => {
    const reading = read('clear PET and PP lid');
    expect(reading.facts).not.toHaveProperty('material');
    expect(reading.conflicts).toEqual([{ key: 'material', found: ['PET', 'PP'] }]);
  });

  it('reads text glued with punctuation and in capitals', () => {
    expect(read('14OZ,Bagasse-Bowl').facts).toEqual(read('14oz bagasse bowl').facts);
  });

  it('reads a product type inside a longer name as the longer one', () => {
    expect(read('Bowl Lid').facts.productType).toBe('BLD');
    expect(read('lid with straw hole').facts).toEqual({ productType: 'CLD', lidOpening: 'SH' });
  });

  it('reads a material named inside a product type', () => {
    expect(read('12oz double-wall paper cup, 2 colour print').facts).toEqual({
      productType: 'CUP',
      material: 'B00',
      capacity: { unit: 'Z', value: '12' },
      wall: 'DW',
      print: '02',
    });
  });

  it('reads kraft as a brown colour only on paper', () => {
    expect(read('kraft takeout box').facts.colourClarity).toBe('BR');
    expect(read('kraft PP container').facts).not.toHaveProperty('colourClarity');
  });

  it('reads nothing from a number with no unit and no product type', () => {
    const reading = read('Cava order 12');
    expect(reading.facts).toEqual({});
    expect(reading.ignored).toEqual(['Cava', 'order', '12']);
  });

  it('reads a size by the product type it is given, which wins over the text', () => {
    const reading = read('PET lid 90', 'PCL');
    expect(reading.facts).toMatchObject({ productType: 'PCL', material: 'APT', topDiameter: { value: '90', unit: 'mm' } });
  });
});

describe('readText, #58', () => {
  const inches = (value: string) => ({ value, unit: 'in' });
  const mm = (value: string) => ({ value, unit: 'mm' });

  it.each(['Box 20-1/8 x 13 x 10', 'Box 20 1/8 x 13 x 10', 'Box 20⅛ x 13 x 10'])('reads a size with a fraction, %s, in inches', (text) => {
    expect(read(text).facts).toEqual({ productType: 'FCB', length: inches('20.125'), width: inches('13'), height: inches('10') });
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
    expect(reading.facts).toEqual({ productType: 'CLD' });
    expect(reading.conflicts).toEqual([{ key: 'capacity', found }]);
    expect(reading.ignored).toEqual([]);
  });

  it.each([
    ['Paper cup 3-color', '03'],
    ['Paper cup 3 colours', '03'],
    ['Paper cup 3 color printing', '03'],
    ['Paper cup with 3-color print', '03'],
    ['Paper cup full colour printing', 'FC'],
  ])('reads %s as print %s, and not as a size', (text, print) => {
    const reading = read(text);
    expect(reading.facts).toEqual({ productType: 'CUP', material: 'B00', print });
  });
});

describe('readText after approved changes', () => {
  const STAMP = { number: 1, at: new Date('2026-10-27T10:00:00.000Z') };
  const changed = (slot: DictionarySlotKey, code: string, proposal: Proposal) =>
    applyProposal(dictionary, { slot, code }, proposal, STAMP);
  const renamed = (slot: DictionarySlotKey, code: string, newCode: string) =>
    changed(slot, code, { kind: 'edit', newCode, meaning: null, searchWords: null });
  const withWords = (slot: DictionarySlotKey, code: string, searchWords: string[]) =>
    changed(slot, code, { kind: 'edit', newCode: null, meaning: null, searchWords });

  it('reads a keyword for a renamed option in its new letters', () => {
    expect(readText('12oz double wall paper cup', renamed('wall', 'DW', 'DQ')).facts.wall).toBe('DQ');
  });

  it('reads a word-list word for a renamed material as that material', () => {
    expect(readText('14oz Bagasse Bowl', renamed('material', 'CBG', 'CBQ')).facts.material).toBe('CBQ');
  });

  it("leaves a deleted option's keyword not known, and reports its words as ignored", () => {
    const reading = readText('half dome bowl lid', changed('profile', 'HD', { kind: 'delete', replacement: null }));
    expect(reading.facts).not.toHaveProperty('profile');
    expect(reading.ignored).toEqual(['half', 'dome']);
  });

  it('reads 14oz under a renamed unit', () => {
    expect(readText('14oz bagasse bowl', renamed('capacity', 'Z', 'O')).facts.capacity).toEqual({ unit: 'O', value: '14' });
  });

  it('never reads letters another option took later as that option', () => {
    const withoutMl = changed('capacity', 'M', { kind: 'delete', replacement: null });
    const ozAsM = applyProposal(withoutMl, { slot: 'capacity', code: 'Z' }, { kind: 'edit', newCode: 'M', meaning: null, searchWords: null }, {
      number: 2,
      at: STAMP.at,
    });
    expect(readText('500ml paper cup', ozAsM).facts).not.toHaveProperty('capacity');
    expect(readText('14oz paper cup', ozAsM).facts.capacity).toEqual({ unit: 'M', value: '14' });
  });

  it('never reads letters another option took later as that option, after it is renamed again', () => {
    const withoutMl = changed('capacity', 'M', { kind: 'delete', replacement: null });
    const ozAsM = applyProposal(withoutMl, { slot: 'capacity', code: 'Z' }, { kind: 'edit', newCode: 'M', meaning: null, searchWords: null }, {
      number: 2,
      at: STAMP.at,
    });
    const ozAsQ = applyProposal(ozAsM, { slot: 'capacity', code: 'M' }, { kind: 'edit', newCode: 'Q', meaning: null, searchWords: null }, {
      number: 3,
      at: STAMP.at,
    });
    expect(readText('500ml paper cup', ozAsQ).facts).not.toHaveProperty('capacity');
    expect(readText('14oz paper cup', ozAsQ).facts.capacity).toEqual({ unit: 'Q', value: '14' });
  });

  it("reads a renamed product type's size under its rulings", () => {
    expect(readText('Cup 90mm', renamed('productType', 'CUP', 'CPQ')).facts).toEqual({
      productType: 'CPQ',
      shape: 'RD',
      topDiameter: { value: '90', unit: 'mm' },
    });
  });

  it('reads an approved search word as its option, and not before it is approved', () => {
    expect(readText('sugarcane fibre bowl', withWords('material', 'CBG', ['sugarcane fibre'])).facts.material).toBe('CBG');
    expect(read('sugarcane fibre bowl').facts).not.toHaveProperty('material');
  });

  it('reads an approved search word in any field, and one for a unit after its number', () => {
    expect(readText('oblong tray', withWords('shape', 'RC', ['oblong'])).facts.shape).toBe('RC');
    expect(readText('12 fluid ounces paper cup', withWords('capacity', 'Z', ['fluid ounces'])).facts.capacity).toEqual({
      unit: 'Z',
      value: '12',
    });
  });
});
