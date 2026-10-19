import { describe, expect, it } from 'vitest';
import { SLOT_NAMES } from './atlas';

describe('SLOT_NAMES', () => {
  it('names the 26 slots in code order, as the server does', () => {
    expect(SLOT_NAMES).toHaveLength(26);
    expect(SLOT_NAMES.map((slot) => slot.name)).toEqual([
      'Format version',
      'Product type',
      'Material',
      'Coating',
      'Colour / clarity',
      'Shape',
      'Profile',
      'Nominal capacity',
      'Top diameter',
      'Bottom diameter',
      'Height',
      'Length',
      'Width',
      'Gusset',
      'Unit weight',
      'Basis weight',
      'Thickness',
      'Wall',
      'Print',
      'Compartments',
      'Plies',
      'Lid opening',
      'Handle',
      'Individual wrap',
      'Window',
      'Variant number',
    ]);
    expect(new Set(SLOT_NAMES.map((slot) => slot.key)).size).toBe(26);
  });
});
