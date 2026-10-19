import { describe, expect, it } from 'vitest';
import { asPastedCode } from './pasted-code';

describe('asPastedCode', () => {
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

  it('reads anything else as a name', () => {
    expect(asPastedCode('CUP.BCS.Y')).toBeNull();
    expect(asPastedCode('Lid 2.5.1.0 in')).toBeNull();
    expect(asPastedCode('Bowl lid S1.')).toBeNull();
    expect(asPastedCode('S1 lid')).toBeNull();
    expect(asPastedCode('')).toBeNull();
  });
});
