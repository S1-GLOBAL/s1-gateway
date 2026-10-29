import { describe, expect, it } from 'vitest';
import { applyProposal } from '../suggestions/apply-proposal.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { NO_PRODUCT_TYPE, readVerifiedRow, type VerifiedRow } from './verified-row.js';

const dictionary = s2Dictionary();

const NO_QUOTE = { fobPerUnit: '', fobPerCase: '', fobTotal: '', moldCost: '', moldLeadTime: '', sampleLeadTime: '', productionLeadTime: '' };

/** An invented row: never one of the verified list's own (constraints §6). */
function row(overrides: Partial<VerifiedRow>): VerifiedRow {
  return {
    row: 4,
    itemName: '',
    category: '',
    material: '',
    materialType: '',
    dimension: '',
    weight: '',
    printing: '',
    company: '',
    country: '',
    quote: NO_QUOTE,
    unsavedFormulas: [],
    ...overrides,
  };
}

function read(overrides: Partial<VerifiedRow>) {
  const reading = readVerifiedRow(row(overrides), dictionary);
  if (reading.kind !== 'read') throw new Error(`Row was skipped: ${reading.reason}`);
  return reading;
}

describe('readVerifiedRow, with the description reader (ADR 0032)', () => {
  it('reads the item name, material, sizes, weight and printing as one description', () => {
    const reading = read({ itemName: '16oz Clear Cup', material: 'Plastic', materialType: 'PP', printing: '1c print' });

    expect(reading.facts).toMatchObject({
      productType: 'CUP',
      material: 'APP',
      colourClarity: 'CL',
      print: '01',
      capacity: { unit: 'Z', value: '16' },
    });
    expect(reading.readFromRow).toContain('Material: Polymer, PP');
  });

  it('reads the material type over the family beside it, and over a category that names one', () => {
    expect(read({ itemName: 'Invented cup', category: 'Plastic Cup', material: 'Plastic', materialType: 'PP' }).facts.material).toBe('APP');
  });

  it('reads the category only when nothing else names the product type', () => {
    expect(read({ itemName: 'Invented 12oz drink', category: 'Cup' }).facts.productType).toBe('CUP');
    expect(read({ itemName: 'PP Cup', category: 'Bowl' }).facts.productType).toBe('CUP');
  });

  it('reads a dimension cell written as a number, 90, as a 90 mm rim under ruling R1', () => {
    const reading = read({ itemName: 'Invented lid', materialType: 'PET', dimension: '90' });

    expect(reading.facts).toMatchObject({ shape: 'RD', topDiameter: { value: '90', unit: 'mm' } });
    expect(reading.readFromRow).toContain('Top diameter: 90 mm (R1, from "90")');
  });

  it('reads 3.3g as a unit weight and 110 gsm as a basis weight', () => {
    expect(read({ itemName: 'Invented lid', weight: '3.3g' }).facts).toMatchObject({ unitWeight: { value: '3.3', unit: 'g' } });
    expect(read({ itemName: 'Invented paper bag', weight: '110 gsm' }).facts).toMatchObject({
      basisWeight: { value: '110', unit: 'gsm' },
    });
  });

  it('reads no weight or size from a sum like 300+250+18', () => {
    const facts = read({ itemName: 'Invented bag', weight: '300+250+18' }).facts;
    expect(facts.unitWeight).toBeUndefined();
    expect(facts.basisWeight).toBeUndefined();
    expect(facts.height).toBeUndefined();
  });

  it("keeps the reader's notes for the report", () => {
    expect(read({ itemName: 'Invented paper bowl', printing: 'Printed' }).notes.some((note) => note.startsWith('Printed is mentioned'))).toBe(
      true,
    );
  });

  it('skips a row whose product type cannot be told, and says why', () => {
    const reading = readVerifiedRow(row({ itemName: 'Invented sample order', material: 'Plastic' }), dictionary);

    expect(reading).toMatchObject({ kind: 'skipped', row: 4, reason: NO_PRODUCT_TYPE });
  });

  it('cuts a 130-character item name at the last space before 120 characters, and flags it', () => {
    const itemName = `${'word '.repeat(25)}cup end`.slice(0, 130);
    const reading = read({ itemName, category: 'Cup' });

    expect(itemName).toHaveLength(130);
    expect(reading.name.length).toBeLessThanOrEqual(120);
    expect(reading.name.endsWith(' ')).toBe(false);
    expect(itemName.startsWith(reading.name)).toBe(true);
    expect(itemName.charAt(reading.name.length)).toBe(' ');
    expect(reading.nameCut).toBe(true);
  });

  it('tells whether the Category column names the product type the rest of the row reads as', () => {
    expect(read({ itemName: 'PP Cup', category: 'Cup' }).agreement).toBe(true);
    expect(read({ itemName: 'PP Cup', category: 'Bowl' }).agreement).toBe(false);
    expect(read({ itemName: 'PP Cup', category: 'Invented range' }).agreement).toBeNull();
    expect(read({ itemName: 'Invented 12oz drink', category: 'Cup' }).agreement).toBeNull();
  });
});

describe('readVerifiedRow, each column for what it says (plan 0011)', () => {
  const PLASTIC = { material: 'Plastic', materialType: 'PP' };

  it('reads no product type from the sizes or weight while the item name gives one', () => {
    const reading = read({
      itemName: 'Invented 60 oz PP container black base with clear lid combo',
      ...PLASTIC,
      dimension: 'Top Length: 280, Width: 205, Height: 64',
      weight: '50 g (Tray) / 40 g (Lid)',
    });
    expect(reading.facts).toMatchObject({ productType: 'CWL', height: { value: '64', unit: 'mm' } });
  });

  it('reads the product type from the sizes as a last resort: a vessel and its lid', () => {
    const reading = read({
      itemName: 'Invented pack 500 + lid',
      category: 'Plastic Lid',
      ...PLASTIC,
      dimension: 'Container: length 160 & Lid: length 162',
    });
    expect(reading.facts.productType).toBe('CWL');
  });

  it('lets the Category column settle two product types the item name gives', () => {
    const reading = read({ itemName: 'Invented Bowls - Twisted Paper Bag', category: 'Paper Bag With Handle', material: 'Paper' });
    expect(reading.facts.productType).toBe('BAG');
    expect(reading.agreement).toBeNull();
  });

  it('reads no product type from a material cell, but a kind of the one the item name gives', () => {
    expect(read({ itemName: 'Invented traymat', material: 'Paper', materialType: 'Paper Tray' }).facts.productType).toBe('WRP');
    const lids = read({ itemName: 'Invented dome lids for 7 inch', material: 'Container Lid' });
    expect(lids.facts.productType).toBe('CTL');
    expect(lids.notes).toContain('Container Lid names the kind of Cup lid (A2), so the product is Container lid (A9).');
  });

  it("reads the material cells' material over a vessel's a lid's name mentions, and a grade in the item name over their family", () => {
    expect(read({ itemName: 'Invented lid for 16/20 round bagasse bowl', material: 'Plastic', materialType: 'PET' }).facts.material).toBe('APT');
    expect(read({ itemName: 'Invented PLA fork', material: 'Plastic' }).facts.material).toBe('APL');
    expect(read({ itemName: 'Invented wrap', material: 'Paper', materialType: 'Greaseproof' }).facts.material).toBe('BGP');
  });

  it('reads the Dimension cell before the item name, and the Category column only for what the rest leaves unsaid', () => {
    expect(read({ itemName: 'Invented 9x5x11 kraft paper bag', material: 'Paper', dimension: '230 x 120 x 280' }).facts).toMatchObject({
      width: { value: '230', unit: 'mm' },
      gusset: { value: '120', unit: 'mm' },
      height: { value: '280', unit: 'mm' },
    });
    expect(read({ itemName: 'Invented ripple wall paper cup', category: 'Paper Cup - Double Wall' }).facts.wall).toBe('RW');
    expect(read({ itemName: 'Invented cup', category: 'Paper Cup - Double Wall' }).facts.wall).toBe('DW');
  });

  it('keeps a length waiting on the shape once the Category column gives it', () => {
    const reading = read({ itemName: 'Invented bento box', category: 'Plastic Container - Square', ...PLASTIC, dimension: '260 x 200 x 50 mm' });
    expect(reading.facts).toMatchObject({ productType: 'CTN', shape: 'SQ', length: { value: '260', unit: 'mm' } });
  });

  it('reads a weight with no unit as grams where the product has no basis weight, and not at all where it has both', () => {
    const lid = read({ itemName: 'Invented lid', ...PLASTIC, weight: '9.5' });
    expect(lid.facts).toMatchObject({ unitWeight: { value: '9.5', unit: 'g' } });
    expect(lid.facts.topDiameter).toBeUndefined();
    const bag = read({ itemName: 'Invented paper bag', material: 'Paper', weight: '110' });
    expect(bag.facts.unitWeight).toBeUndefined();
    expect(bag.facts.basisWeight).toBeUndefined();
    expect(bag.notes).toContain('The weight 110 has no unit, g or gsm, so it was not read.');
  });

  it('flags a size with no unit that is small for millimetres', () => {
    const reading = read({ itemName: 'Invented paper bag', material: 'Paper', dimension: '12 x 7.5 x 13' });
    expect(reading.facts).toMatchObject({ height: { value: '13', unit: 'mm' } });
    expect(reading.notes).toContain('12 x 7.5 x 13 has no unit, so it was read in millimetres (#58). That is small for Bag (A16): check the unit.');
  });
});

describe('readVerifiedRow after an approved change (ADR 0031)', () => {
  it('reads an approved search word in the item name as its option', () => {
    const withWord = applyProposal(dictionary, { slot: 'material', code: 'CBG' }, { kind: 'edit', newCode: null, meaning: null, searchWords: ['sugarcane fibre'] }, {
      number: 1,
      at: new Date('2026-10-27T10:00:00.000Z'),
    });
    const reading = readVerifiedRow(row({ itemName: '12oz sugarcane fibre bowl' }), withWord);
    expect(reading.kind === 'read' && reading.facts.material).toBe('CBG');
  });
});
