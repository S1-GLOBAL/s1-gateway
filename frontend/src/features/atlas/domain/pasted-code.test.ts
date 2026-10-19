import { describe, expect, it } from 'vitest';
import { asPastedCode } from './pasted-code';

describe('asPastedCode', () => {
  it('reads text starting with S2. as a code, trimmed and upper-cased', () => {
    expect(asPastedCode('  s2.cup.apt  ')).toBe('S2.CUP.APT');
  });

  it('reads text starting with S1. as a code too: codes given out before S2 still find their product', () => {
    expect(asPastedCode('  s1.bld.aps  ')).toBe('S1.BLD.APS');
    expect(asPastedCode('S1.BLD')).toBe('S1.BLD');
  });

  it('reads anything else as a name', () => {
    expect(asPastedCode('Bowl lid S1.')).toBeNull();
    expect(asPastedCode('S1 lid')).toBeNull();
    expect(asPastedCode('')).toBeNull();
  });
});
