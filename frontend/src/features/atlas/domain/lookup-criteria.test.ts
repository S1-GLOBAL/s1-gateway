import { describe, expect, it } from 'vitest';
import { initialLookupForm, toCriteria, type LookupForm } from './lookup-criteria';

function form(changes: Partial<LookupForm> = {}, codes: Partial<LookupForm['codes']> = {}): LookupForm {
  const initial = initialLookupForm();
  return { ...initial, ...changes, codes: { ...initial.codes, ...codes } };
}

describe('toCriteria', () => {
  it('asks about nothing when every slot is left at Any', () => {
    expect(toCriteria(form())).toEqual({});
  });

  it('asks about the codes chosen', () => {
    expect(toCriteria(form({ productType: 'BLD' }, { shape: 'RD', material: 'APS' }))).toEqual({
      productType: 'BLD',
      shape: 'RD',
      material: 'APS',
    });
  });

  it("writes each typed measure as the slot's raw text", () => {
    const initial = initialLookupForm();
    const criteria = toCriteria(
      form({ measures: { ...initial.measures, topDiameter: '90', unitWeight: '3.3', basisWeight: ' 45 ' } }),
    );
    expect(criteria).toEqual({ topDiameter: '0090', unitWeight: '0033', basisWeight: '045' });
  });

  it('writes a capacity as its unit letter and a padded whole number', () => {
    expect(toCriteria(form({ capacityUnit: 'Z', capacityValue: '6' }))).toEqual({ capacity: 'Z0006' });
  });

  it('passes a capacity without an amount, and a measure that is not a number, as typed', () => {
    const initial = initialLookupForm();
    expect(toCriteria(form({ capacityUnit: 'Z' }))).toEqual({ capacity: 'Z' });
    expect(toCriteria(form({ measures: { ...initial.measures, height: '12a' } }))).toEqual({ height: '12a' });
  });
});
