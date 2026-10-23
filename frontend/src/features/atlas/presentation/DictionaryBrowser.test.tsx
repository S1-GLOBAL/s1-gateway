import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AtlasDictionary, SlotKey, SlotRule } from '../domain/atlas';
import { DictionaryBrowser } from './DictionaryBrowser';

const RULED: readonly SlotKey[] = [
  'coating',
  'colourClarity',
  'shape',
  'profile',
  'capacity',
  'topDiameter',
  'bottomDiameter',
  'height',
  'length',
  'width',
  'gusset',
  'unitWeight',
  'basisWeight',
  'thickness',
];

const CODES: Record<string, SlotRule> = {
  A: 'applies',
  N: 'never',
  R: 'round_only',
  O: 'non_round_only',
  P: 'paper_only',
};

/** "Which slots apply", one letter per ruled slot in slot order. */
const TABLE: Record<string, string> = {
  BLD: 'AAAANRNAOONAPA',
  BWL: 'AAANARRAOONAPA',
  CLD: 'AAAANRNAOONAPA',
  SUP: 'AANNANNANAAAAA',
};

const dictionary: AtlasDictionary = {
  release: 'S1 0.1.0',
  approvedOn: '2026-10-16',
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid' },
        { code: 'BWL', meaning: 'Bowl' },
        { code: 'CLD', meaning: 'Cup lid' },
        { code: 'SUP', meaning: 'Stand-up pouch' },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)' },
        { code: 'APT', meaning: 'Polymer, PET' },
        { code: 'B00', meaning: 'Paper and paperboard, grade not known' },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft' },
      ],
    },
    {
      key: 'coating',
      name: 'Coating',
      values: [
        { code: 'NC', meaning: 'No coating, as stated by the source' },
        { code: 'PB', meaning: 'PE both sides' },
        { code: 'PI', meaning: 'PE inside only' },
        { code: 'PO', meaning: 'PE outside only' },
      ],
    },
    {
      key: 'colourClarity',
      name: 'Colour / clarity',
      values: [
        { code: 'BR', meaning: 'Brown' },
        { code: 'CL', meaning: 'Clear' },
        { code: 'TL', meaning: 'Translucent' },
        { code: 'WH', meaning: 'White' },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'OV', meaning: 'Oval' },
        { code: 'RC', meaning: 'Rectangular' },
        { code: 'RD', meaning: 'Round' },
        { code: 'SQ', meaning: 'Square' },
      ],
    },
    {
      key: 'profile',
      name: 'Profile',
      values: [
        { code: 'DM', meaning: 'Dome' },
        { code: 'FL', meaning: 'Flat' },
        { code: 'HD', meaning: 'Half dome' },
      ],
    },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'G', meaning: 'Grams' },
        { code: 'M', meaning: 'Millilitres' },
        { code: 'N', meaning: 'Count' },
        { code: 'S', meaning: 'Servings' },
        { code: 'Z', meaning: 'Ounces, nominal trade size' },
      ],
    },
  ],
  rules: Object.entries(TABLE).flatMap(([productType, letters]) =>
    RULED.map((slot, index) => ({ productType, slot, rule: CODES[letters[index] ?? 'A'] ?? 'applies' })),
  ),
};

describe('DictionaryBrowser', () => {
  it('shows one card per dictionary slot, with each code and its meaning', () => {
    render(<DictionaryBrowser dictionary={dictionary} />);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(7);
    const shape = screen.getByRole('article', { name: 'Shape' });
    expect(within(shape).getByText('RD')).toBeTruthy();
    expect(within(shape).getByText('Round')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Nominal capacity' })).getAllByRole('definition')).toHaveLength(5);
  });

  it("shows which slots apply to the chosen product type, in the specification's words", () => {
    render(<DictionaryBrowser dictionary={dictionary} />);

    expect(screen.getByRole('heading', { name: 'Which slots apply' })).toBeTruthy();
    const productType = screen.getByRole('combobox', { name: 'Product type' });
    expect((productType as HTMLSelectElement).value).toBe('BLD');

    const table = screen.getByRole('table', { name: 'Which slots apply' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Slot', 'Rule']);
    expect(within(table).getAllByRole('row')).toHaveLength(15);

    const cell = (slot: string) =>
      within(within(table).getByRole('row', { name: new RegExp(slot) })).getByRole('cell').textContent;
    expect(cell('Top diameter')).toBe('Round only');
    expect(cell('Basis weight')).toBe('Paper family only');
    expect(cell('Length')).toBe('Non-round only');

    fireEvent.change(productType, { target: { value: 'SUP' } });

    expect(cell('Top diameter')).toBe('X');
    expect(cell('Basis weight')).toBe('Applies');
    expect(cell('Length')).toBe('X');
  });
});
