import { describe, expect, it } from 'vitest';
import { s2Dictionary, testDictionary } from '../application/testing/atlas-fixtures';
import { initialBuildForm, isFormChanged, toFacts, type BuildForm } from './build-facts';

const { rules } = testDictionary;

function form(changes: Partial<BuildForm> = {}, codes: Partial<BuildForm['codes']> = {}): BuildForm {
  const initial = initialBuildForm('BLD');
  return { ...initial, ...changes, codes: { ...initial.codes, ...codes } };
}

describe('toFacts', () => {
  it('sends only the product type for an untouched form', () => {
    expect(toFacts(form(), rules)).toEqual({ productType: 'BLD' });
  });

  it('sends what was chosen and typed, trimmed, in the unit chosen', () => {
    const initial = initialBuildForm('BLD');
    const facts = toFacts(
      form(
        { measures: { ...initial.measures, topDiameter: { value: ' 90 ', unit: 'mm' }, unitWeight: { value: '3.3', unit: 'g' } } },
        { material: 'APS', colourClarity: 'CL', shape: 'RD', profile: 'DM' },
      ),
      rules,
    );
    expect(facts).toEqual({
      productType: 'BLD',
      material: 'APS',
      colourClarity: 'CL',
      shape: 'RD',
      profile: 'DM',
      topDiameter: { value: '90', unit: 'mm' },
      unitWeight: { value: '3.3', unit: 'g' },
    });
  });

  it('sends nothing for a measure left empty', () => {
    const initial = initialBuildForm('BLD');
    const facts = toFacts(form({ measures: { ...initial.measures, height: { value: '  ', unit: 'cm' } } }), rules);
    expect(facts).not.toHaveProperty('height');
  });

  it('drops a value typed for a slot that does not apply', () => {
    const initial = initialBuildForm('BLD');
    const facts = toFacts(
      form({
        capacityUnit: 'Z',
        capacityValue: '6',
        measures: { ...initial.measures, bottomDiameter: { value: '60', unit: 'mm' } },
      }),
      rules,
    );
    expect(facts).toEqual({ productType: 'BLD' });
  });

  it('keeps those values once the product type lets them apply', () => {
    const initial = initialBuildForm('BWL');
    const facts = toFacts(
      {
        ...initial,
        capacityUnit: 'Z',
        capacityValue: ' 6 ',
        measures: { ...initial.measures, bottomDiameter: { value: '60', unit: 'mm' } },
      },
      rules,
    );
    expect(facts).toEqual({
      productType: 'BWL',
      capacity: { unit: 'Z', value: '6' },
      bottomDiameter: { value: '60', unit: 'mm' },
    });
  });

  it('drops a value that waits for a shape not yet chosen, and one the shape rules out', () => {
    const initial = initialBuildForm('BLD');
    const measures = { ...initial.measures, topDiameter: { value: '90', unit: 'mm' } };
    expect(toFacts(form({ measures }), rules)).toEqual({ productType: 'BLD' });
    expect(toFacts(form({ measures }, { shape: 'SQ' }), rules)).toEqual({ productType: 'BLD', shape: 'SQ' });
  });

  it('sends a capacity with decimals as typed', () => {
    const facts = toFacts(form({ productType: 'BWL', capacityUnit: 'Z', capacityValue: ' 3.25 ' }), rules);
    expect(facts.capacity).toEqual({ unit: 'Z', value: '3.25' });
  });

  it('sends a capacity unit without an amount, for the server to name', () => {
    const facts = toFacts(form({ productType: 'BWL', capacityUnit: 'Z' }), rules);
    expect(facts.capacity).toEqual({ unit: 'Z', value: '' });
  });

  it('sends a count typed 03 as 3, and nothing for a count left empty', () => {
    const facts = toFacts(form({ counts: { compartments: ' 03 ', plies: '' } }), rules);
    expect(facts).toEqual({ productType: 'BLD', compartments: '3' });
  });

  it('sends a count that is not a whole number as typed, for the server to name', () => {
    expect(toFacts(form({ counts: { compartments: '', plies: '2.5' } }), rules).plies).toBe('2.5');
  });

  it('sends the new choices, and drops a count the product type never has', () => {
    const initial = initialBuildForm('CUP');
    const facts = toFacts(
      {
        ...initial,
        codes: { ...initial.codes, wall: 'DW', print: '02' },
        counts: { compartments: '3', plies: '' },
      },
      s2Dictionary.rules,
    );
    expect(facts).toEqual({ productType: 'CUP', wall: 'DW', print: '02' });
  });
});

describe('isFormChanged', () => {
  it('is false for the form as it was', () => {
    expect(isFormChanged(form(), form(), rules)).toBe(false);
  });

  it('is true once a fact changes', () => {
    expect(isFormChanged(form(), form({}, { material: 'APS' }), rules)).toBe(true);
  });

  it('is false after a change and its undo', () => {
    const changed = form({}, { material: 'APS' });
    const undone = { ...changed, codes: { ...changed.codes, material: '' } };
    expect(isFormChanged(form(), undone, rules)).toBe(false);
  });

  it('is false for a value typed into a slot that does not apply', () => {
    expect(isFormChanged(form(), form({ capacityUnit: 'Z', capacityValue: '16' }), rules)).toBe(false);
  });
});
