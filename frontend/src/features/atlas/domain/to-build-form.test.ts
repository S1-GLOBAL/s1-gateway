import { describe, expect, it } from 'vitest';
import { ILLUSTRATIVE, readCode, testDictionary, withSlot } from '../application/testing/atlas-fixtures';
import { toFacts } from './build-facts';
import { toBuildForm } from './to-build-form';

describe('toBuildForm', () => {
  it('fills the form so that it sends the facts the illustrative code was built from', () => {
    expect(toFacts(toBuildForm(readCode(ILLUSTRATIVE)), testDictionary.rules)).toEqual({
      productType: 'BLD',
      material: 'APS',
      colourClarity: 'CL',
      shape: 'RD',
      profile: 'DM',
      topDiameter: { value: '90', unit: 'mm' },
      unitWeight: { value: '3.3', unit: 'g' },
    });
  });

  it('leaves every slot not known or not applying empty', () => {
    const form = toBuildForm(readCode(ILLUSTRATIVE));
    expect(form.codes.coating).toBe('');
    expect(form.capacityUnit).toBe('');
    expect(form.measures.height).toEqual({ value: '', unit: 'mm' });
    expect(form.measures.basisWeight).toEqual({ value: '', unit: 'gsm' });
  });

  it('splits a capacity into its unit and its amount, without leading zeros', () => {
    const form = toBuildForm(readCode(withSlot(withSlot(ILLUSTRATIVE, 'productType', 'BWL'), 'capacity', 'Z0016')));
    expect(form.capacityUnit).toBe('Z');
    expect(form.capacityValue).toBe('16');
  });

  it('fills every new slot, so that the form sends the facts a code was built from', () => {
    const code = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.DW.02.03.2.SP.TW.PW.WN.X';
    expect(toFacts(toBuildForm(readCode(code)), testDictionary.rules)).toEqual({
      productType: 'BLD',
      material: 'APS',
      colourClarity: 'CL',
      shape: 'RD',
      profile: 'DM',
      topDiameter: { value: '90', unit: 'mm' },
      unitWeight: { value: '3.3', unit: 'g' },
      wall: 'DW',
      print: '02',
      compartments: '3',
      plies: '2',
      lidOpening: 'SP',
      handle: 'TW',
      wrap: 'PW',
      window: 'WN',
    });
  });

  it('leaves a count not known or not applying empty', () => {
    expect(toBuildForm(readCode(ILLUSTRATIVE)).counts).toEqual({ compartments: '', plies: '' });
  });

  it('reads a unit weight of whole grams without a decimal point', () => {
    const form = toBuildForm(readCode(withSlot(ILLUSTRATIVE, 'unitWeight', '0040')));
    expect(form.measures.unitWeight.value).toBe('4');
  });
});
