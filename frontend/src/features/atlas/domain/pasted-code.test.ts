import { describe, expect, it } from 'vitest';
import { asPastedCode } from './pasted-code';

describe('asPastedCode', () => {
  it('reads a code written today as a code, in any order and either case, trimmed and upper-cased', () => {
    expect(asPastedCode('  a5b17d3e1q2r3-g112h90j110  ')).toBe('A5B17D3E1Q2R3-G112H90J110');
    expect(asPastedCode('A1B4D1E1F1-H90N33')).toBe('A1B4D1E1F1-H90N33');
    expect(asPastedCode('B17A5')).toBe('B17A5');
    expect(asPastedCode('a5b17')).toBe('A5B17');
    expect(asPastedCode('A5')).toBe('A5');
  });

  it('reads a decimal capacity as part of a code, and only after G', () => {
    expect(asPastedCode('A6-G13.25')).toBe('A6-G13.25');
    expect(asPastedCode('a6-g10.5')).toBe('A6-G10.5');
    expect(asPastedCode('A6-H9.5')).toBeNull();
    expect(asPastedCode('A6-G13.')).toBeNull();
    expect(asPastedCode('A6-G1.2.5')).toBeNull();
  });

  it('reads text with no space and at least three dots as a code, trimmed and upper-cased', () => {
    expect(asPastedCode('  cup.bcs.y.wh.rd.x.z0012.0090.y.0110.x.x.x.y.y.y.dw.02.x.x.x.x.x.x.x  ')).toBe(
      'CUP.BCS.Y.WH.RD.X.Z0012.0090.Y.0110.X.X.X.Y.Y.Y.DW.02.X.X.X.X.X.X.X',
    );
    expect(asPastedCode('CUP.BCS.Y.WH')).toBe('CUP.BCS.Y.WH');
  });

  it('reads text starting with S2. or S1. as a code too: codes given out before still find their product', () => {
    expect(asPastedCode('  s2.cup.apt  ')).toBe('S2.CUP.APT');
    expect(asPastedCode('  s1.bld.aps  ')).toBe('S1.BLD.APS');
    expect(asPastedCode('S1.BLD')).toBe('S1.BLD');
  });

  it('reads a letter without a number as a name: every letter of a code has one', () => {
    expect(asPastedCode('Cup')).toBeNull();
    expect(asPastedCode('Cup12')).toBeNull();
    expect(asPastedCode('A5B')).toBeNull();
    expect(asPastedCode('12oz')).toBeNull();
  });

  it('reads anything else as a name', () => {
    expect(asPastedCode('CUP.BCS.Y')).toBeNull();
    expect(asPastedCode('Lid 2.5.1.0 in')).toBeNull();
    expect(asPastedCode('Bowl lid S1.')).toBeNull();
    expect(asPastedCode('S1 lid')).toBeNull();
    expect(asPastedCode('A5 B17')).toBeNull();
    expect(asPastedCode('Y1Z2')).toBeNull();
    expect(asPastedCode('A5-G112-H90')).toBeNull();
    expect(asPastedCode('A5-')).toBeNull();
    expect(asPastedCode('-G112')).toBeNull();
    expect(asPastedCode('')).toBeNull();
  });
});
