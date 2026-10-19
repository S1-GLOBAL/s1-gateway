import { describe, expect, it } from 'vitest';
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
