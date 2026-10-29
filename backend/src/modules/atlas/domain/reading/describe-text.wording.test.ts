import { describe, expect, it } from 'vitest';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { describeText, factsInWords } from './describe-text.js';
import { readText } from './read-text.js';

const dictionary = s2Dictionary();
const mm = (value: string) => ({ value, unit: 'mm' });

/** The facts kept and the notes, for invented wording written the ways a supplier list writes it (plan 0011). */
function described(text: string, productType?: string) {
  const description = describeText(text, dictionary, productType);
  return { facts: description.facts, notes: description.notes, code: description.specId?.code ?? null, ignored: description.ignored };
}

describe('reading a product type as a supplier list writes it (plan 0011)', () => {
  it.each([
    ['one or many', '2 ply napkins', 'NPK'],
    ['the kind over its general word', 'stand-up pouch bag', 'SUP'],
    ['the kind over its general word', 'corrugated box small box', 'RSC'],
    ['the kind over its general word', 'hinged burger box', 'HCT'],
    ['the kind over its general word', 'cup souffle 2oz', 'PCP'],
    ['the kind over its general word', 'invented meal tray container', 'TRY'],
    ['a hinge lid on a carton', 'carton, burger hinge lid', 'HCT'],
    ['a box that is not paperboard', 'PP 5 compartment bento box', 'CTN'],
    ['two kinds of cutlery', 'knife + fork + napkin', 'CKT'],
    ['the last noun of two that overlap', 'paper cup carrier', 'CCR'],
    ['a fry carton', 'carton small fry', 'FRC'],
    ['a wrap beside a product that is wrapped', 'PLA straw with individual paper wrap', 'STW'],
    ['a vessel with a lid joined to it by a few words', 'cold paper cup SW with dome lid', 'CWC'],
    ['a vessel with a lid joined to it by a few words', 'PP container black base with clear lid combo', 'CWL'],
    ['a vessel and a lid joined anywhere', 'invented pack 500 + lid, container: 160 & lid: 162', 'CWL'],
    ['a lid for a tray', 'bagasse lid for 100 oz tray', 'CTL'],
    ['a lid for a box', 'invented bento box lid', 'CTL'],
    ['a lid for a souffle, the words reversed', 'lid souffle 2oz', 'PCL'],
    ['a soup cup as the bowl it is filed as', '12 oz white paper soup cup', 'BWL'],
    ['a lid for a soup cup as a bowl lid', 'flat PP lid for paper soup cup', 'BLD'],
    ['a soup cup with its lid', 'soup cup with lid', 'BWB'],
  ])('reads %s: "%s" is %s', (_case, text, productType) => {
    expect(described(text).facts.productType).toBe(productType);
  });

  it('reads no plate in a printing plate fee', () => {
    expect(described('8 oz printed double wall paper cup, printing plate fee').facts.productType).toBe('CUP');
    expect(described('printing plate').facts.productType).toBeUndefined();
  });

  it('reads the product a handle or plies belong to, and says so', () => {
    const bag = described('10 x 7 x 12 in twisted handle');
    expect(bag.facts).toMatchObject({ productType: 'BAG', handle: 'TW' });
    expect(bag.notes).toContain('Only Bag (A16) has a handle, so that is the product.');
    expect(described('2 ply').facts.productType).toBe('NPK');
  });

  it('reads no product from one named only as what comes with it, and says so', () => {
    const lids = described('Invented 16/4 w/ printed lids');
    expect(lids.facts.productType).toBeUndefined();
    expect(lids.notes).toContain('Cup lid (A2) comes with the product, but the product itself is not named.');
  });

  it('writes no note about a material given, which is final', () => {
    const description = describeText('brown virgin kraft paper bag', dictionary, 'BAG', 'BKB');
    expect(description.facts.material).toBe('BKB');
    expect(description.notes.some((note) => note.startsWith('Material'))).toBe(false);
  });

  it('keeps a product type given, whatever the passes would read', () => {
    expect(described('12oz cup with lid', 'CUP').facts.productType).toBe('CUP');
    expect(described('cup lid for a bowl', 'CUP').facts.productType).toBe('CUP');
  });
});

describe('reading other facts as a supplier list writes them (plan 0011)', () => {
  it('reads a wrap as how a straw or fork is wrapped, and its paper as no material', () => {
    expect(described('PLA straw with individual paper wrap').facts).toMatchObject({ material: 'APL', wrap: 'PW' });
    expect(described('6.5 inches PLA fork (paper wrap)').facts).toMatchObject({ productType: 'FRK', material: 'APL', wrap: 'PW' });
    expect(described('seaweed straw (no wrap)').facts).toMatchObject({ wrap: 'NW' });
  });

  it('reads kraft as a family of paper, and kraft as brown only off white kraft', () => {
    expect(readText('kraft, recycled kraft', dictionary).facts.material).toBe('BKC');
    expect(described('kraft paper bag, white kraft').facts).toMatchObject({ material: 'BKW', colourClarity: 'WH' });
  });

  it('reads no material named as absent', () => {
    expect(described('plastic free paper cup').facts.material).toBe('B00');
    expect(described('PP free bagasse bowl').facts.material).toBe('CBG');
  });

  it('leaves a list of capacities out, and reads none of it again by its own name', () => {
    expect(described('paper cup 16/20oz').facts.capacity).toBeUndefined();
    expect(described('kraft sleeve for 12/16/20oz').facts.capacity).toBeUndefined();
  });

  it('reads flat beside a lid as its profile', () => {
    expect(described('12oz Flat PP Lids').facts.profile).toBe('FL');
    expect(described('90mm PET paper cup lid - Flat').facts.profile).toBe('FL');
  });

  it('leaves out a colour given twice, though one colour is named on its own', () => {
    expect(described('4oz PS lid, White/Black').facts.colourClarity).toBeUndefined();
  });

  it('reads 280g paper as the paper weight, and no stack of weights as a unit weight', () => {
    expect(described('8oz paper cup, 280g paper+PE').facts).toMatchObject({ basisWeight: { value: '280', unit: 'gsm' } });
    expect(described('10oz paper cup, 310+18pe+90+150g').facts.unitWeight).toBeUndefined();
    expect(described('invented fork, 4,2 grams').facts.unitWeight).toBeUndefined();
  });
});

describe('reading sizes as a supplier list writes them (plan 0011)', () => {
  it.each([
    ['named, over a ruling that took one of their numbers', 'bowl, top diameter 180 x bottom diameter 150 X height 70 mm', { topDiameter: mm('180'), bottomDiameter: mm('150'), height: mm('70') }],
    ['named with colons', 'cup, rim: 80 mm height: 95 mm bottom: 56mm', { shape: 'RD', topDiameter: mm('80'), bottomDiameter: mm('56'), height: mm('95') }],
    ['named by one letter', 'cup, t:88mm*h:96mm*b:58mm', { topDiameter: mm('88'), bottomDiameter: mm('58'), height: mm('96') }],
    ['named with a diameter sign', 'cup, topφ: 81.4 bottom φ: 57.5 height: 93.5', { topDiameter: mm('81.4'), bottomDiameter: mm('57.5'), height: mm('93.5') }],
    ['named top and base', 'cup, top dia 92mm, base dia 72mm, height 60mm', { topDiameter: mm('92'), bottomDiameter: mm('72'), height: mm('60') }],
    ['named on a clamshell, rectangular as R6 names it', 'hinged burger box, L115 x W120 x H72 mm', { shape: 'RC', length: mm('115'), width: mm('120'), height: mm('72') }],
    ['named on a bag, with its side gusset', 'paper bag, W350 x H410 x SG250 mm', { width: mm('350'), height: mm('410'), gusset: mm('250') }],
    ['a plate diameter', 'round bagasse plate, 230 Dia × 22 H mm', { shape: 'RD', topDiameter: mm('230'), height: mm('22') }],
    ['a rim marked "diameter", with words after it', '14oz PET cup with 98mm diameter plain', { topDiameter: mm('98') }],
    ['a rim marked "dia" over a stray number', '16oz PP cup, 96 Dia, 7.5 grams (+/- 0.5)', { topDiameter: mm('96') }],
    ['named in a list after its numbers', 'fry carton 350.5 x 170.2 mm (Top Length x Width)', { length: mm('350.5'), width: mm('170.2') }],
    ['named in a list, in its own order over R6', 'tray 200 x 150 x 40 (W x L x H)', { width: mm('200'), length: mm('150'), height: mm('40') }],
    ['named in a list by letters, a gusset among them', 'paper bag 250 x 120 x 300 (W x G x H)', { width: mm('250'), gusset: mm('120'), height: mm('300') }],
    ['R6 on a plate', 'oval plate 250 × 190 × 25 H mm', { length: mm('250'), width: mm('190'), height: mm('25') }],
    ['R6 on a cup carrier', 'bagasse cup carrier 215 mm x 215 mm x 50 mm', { length: mm('215'), width: mm('215'), height: mm('50') }],
  ])('reads a size %s', (_case, text, facts) => {
    expect(described(text).facts).toMatchObject(facts);
  });

  it('reads a size with its unit over the same size with none, and leaves neither over', () => {
    const bag = described('HDPE t-shirt bag, 304.8 x 152.4 x 508 mm (12 x 6 x 20 in)');
    expect(bag.facts).toMatchObject({ width: mm('304.8'), gusset: mm('152.4'), height: mm('508') });
    expect(bag.code).toBe('A16B6V4-J508L305M152');
    expect(bag.notes.some((note) => note.includes('has no unit'))).toBe(false);
    expect(described('paper bag 11 x 6 x 13, 11 x 6 x 13 in').facts).toMatchObject({ width: mm('279'), gusset: mm('152'), height: mm('330') });
  });

  it('reads no list whose names are not as many as its numbers, nor all sizes', () => {
    expect(described('invented box 300 x 200 (Length x Width x Height)').facts.length).toBeUndefined();
    expect(described('invented box 300 x 200 (Length x Colour)').facts.length).toBeUndefined();
  });

  it('reads no rim from a model code, the second of two numbers, or a size too narrow for a rim', () => {
    expect(described('Deli-34 (plain) PET bowl').facts.topDiameter).toBeUndefined();
    expect(described('12oz cup 90 x 110').facts.topDiameter).toBeUndefined();
    expect(described('PET bowl lid, 9.5').facts.topDiameter).toBeUndefined();
  });

  it('says a number with no unit could be the capacity only where it stands alone', () => {
    expect(described('Printed 500 paper bowl').notes).toContain('500 has no unit. If it is the capacity, write 500 ml or 500 oz.');
    expect(described('bagasse tray 360 x 360 mm').notes.some((note) => note.includes('has no unit'))).toBe(false);
  });
});

describe('the facts kept, in words, for a reading a supplier list writes (plan 0011)', () => {
  it('names a round shape kept after its ruling gave way, with no ruling', () => {
    const description = describeText('cup, top diameter 180 x bottom diameter 150 X height 70 mm', dictionary);
    expect(description.reading.read.find((fact) => fact.key === 'shape')?.ruling ?? null).toBeNull();
    expect(factsInWords(description, dictionary).map((fact) => fact.meaning)).toContain('180 mm');
  });
});
