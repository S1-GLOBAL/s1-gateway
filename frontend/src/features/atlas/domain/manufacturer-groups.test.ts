import { describe, expect, it } from 'vitest';
import type { ManufacturerStage, SpecIdManufacturer } from './atlas';
import { manufacturerGroups, shownLeadTime, shownValue } from './manufacturer-groups';

/** An invented manufacturer: never Source One data (ADR 0027). */
const manufacturer = (name: string, stage: ManufacturerStage): SpecIdManufacturer => ({
  id: name,
  name,
  country: 'Atlantis',
  stage,
  stageSet: null,
  quotes: [],
});

describe('manufacturerGroups', () => {
  it("puts each manufacturer in its stage's group, in #57's order, with #57's names and descriptions", () => {
    const groups = manufacturerGroups([
      manufacturer('Dune Packaging', 'in-production'),
      manufacturer('Acme Packaging', 'quoted'),
      manufacturer('Cascade Cartons', 'sampling'),
      manufacturer('Borealis Boxes', 'specifications-received'),
      manufacturer('Ember Boxes', 'quoted'),
    ]);

    expect(groups.map(({ name, description, manufacturers }) => [name, description, manufacturers.map((m) => m.name)])).toEqual([
      ['Specifications received', 'Product details on file, no quotation yet', ['Borealis Boxes']],
      ['Quoted', 'Quotation received', ['Acme Packaging', 'Ember Boxes']],
      ['Sampling', 'Samples in progress', ['Cascade Cartons']],
      ['In production', 'In mass production', ['Dune Packaging']],
    ]);
  });

  it('leaves out a group with no manufacturer', () => {
    expect(manufacturerGroups([manufacturer('Acme Packaging', 'quoted')]).map((group) => group.name)).toEqual(['Quoted']);
    expect(manufacturerGroups([])).toEqual([]);
  });
});

describe('shownValue and shownLeadTime', () => {
  it('shows a value the workbook left empty as "—"', () => {
    expect(shownValue(null)).toBe('—');
    expect(shownValue('$0.0123')).toBe('$0.0123');
    expect(shownLeadTime(null)).toBe('—');
  });

  it('shows a lead time written as a whole number in days, and any other as written', () => {
    expect(shownLeadTime('30')).toBe('30 days');
    expect(shownLeadTime('30-35 days')).toBe('30-35 days');
    expect(shownLeadTime('45 working days')).toBe('45 working days');
  });
});
