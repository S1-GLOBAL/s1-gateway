import { describe, expect, it } from 'vitest';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { NO_PRODUCT_TYPE, readVerifiedRow, type VerifiedRow } from './verified-row.js';

const dictionary = s2Dictionary();

const NO_QUOTE = { fobPerUnit: '', fobPerCase: '', fobTotal: '', moldCost: '', moldLeadTime: '', sampleLeadTime: '', productionLeadTime: '' };

/** An invented row: never one of the verified list's own (constraints §6). */
function row(overrides: Partial<VerifiedRow>): VerifiedRow {
  return { row: 4, itemName: '', category: '', material: '', dimension: '', weight: '', company: '', country: '', quote: NO_QUOTE, unsavedFormulas: [], ...overrides };
}

function read(overrides: Partial<VerifiedRow>) {
  const reading = readVerifiedRow(row(overrides), dictionary);
  if (reading.kind !== 'read') throw new Error(`Row was skipped: ${reading.reason}`);
  return reading;
}

describe('readVerifiedRow', () => {
  it('reads the product type and the material whichever column holds them', () => {
    const straight = read({ itemName: 'Invented cold drink', category: 'Cup', material: 'Plastic - PP' });
    const swapped = read({ itemName: 'Invented cold drink', category: 'Plastic - PP', material: 'Cup' });

    expect(straight.facts).toMatchObject({ productType: 'CUP', material: 'APP' });
    expect(swapped.facts).toMatchObject({ productType: 'CUP', material: 'APP' });
  });

  it('lets a column win over the item name, and lists only what the item name added', () => {
    const reading = read({ itemName: '16oz Clear PP Cup', category: 'Cup', material: 'Plastic - PET' });

    expect(reading.facts).toMatchObject({ productType: 'CUP', material: 'APT', colourClarity: 'CL', capacity: { unit: 'Z', value: '16' } });
    expect(reading.fromItemName.map((note) => note.key)).toEqual(['colourClarity', 'capacity']);
  });

  it('reads a dimension cell written as a number, 90, as a 90 mm rim under ruling R1', () => {
    const reading = read({ itemName: 'Invented lid', category: 'Lid', material: 'Plastic - PET', dimension: '90' });

    expect(reading.facts).toMatchObject({ shape: 'RD', topDiameter: { value: '90', unit: 'mm' } });
    expect(reading.underRuling).toContainEqual({ key: 'topDiameter', words: '90', ruling: 'R1' });
  });

  it('reads 3.3g as a unit weight and 110 gsm as a basis weight', () => {
    expect(read({ itemName: 'Invented lid', category: 'Lid', weight: '3.3g' }).facts).toMatchObject({
      unitWeight: { value: '3.3', unit: 'g' },
    });
    expect(read({ itemName: 'Invented bag', category: 'Bag', material: 'Paper', weight: '110 gsm' }).facts).toMatchObject({
      basisWeight: { value: '110', unit: 'gsm' },
    });
  });

  it('reads neither a bare 25 nor a sum like 300+250+18 as a weight', () => {
    for (const weight of ['25', '300+250+18']) {
      const facts = read({ itemName: 'Invented bag', category: 'Bag', weight }).facts;
      expect(facts.unitWeight).toBeUndefined();
      expect(facts.basisWeight).toBeUndefined();
    }
  });

  it('skips a row whose product type cannot be told, and says why', () => {
    const reading = readVerifiedRow(row({ itemName: 'Invented sample order', material: 'Plastic - PP' }), dictionary);

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

  it('tells whether the item name agrees with the columns, where both give a product type or material', () => {
    expect(read({ itemName: 'PP Cup', category: 'Cup', material: 'Plastic - PP' }).agreement).toBe(true);
    expect(read({ itemName: 'PET Cup', category: 'Cup', material: 'Plastic - PP' }).agreement).toBe(false);
    expect(read({ itemName: 'Invented drink', category: 'Cup' }).agreement).toBeNull();
  });
});
