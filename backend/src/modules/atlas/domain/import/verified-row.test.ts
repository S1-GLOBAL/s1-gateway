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
