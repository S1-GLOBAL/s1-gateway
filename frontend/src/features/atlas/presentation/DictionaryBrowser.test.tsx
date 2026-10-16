import { render, screen, within } from '@testing-library/react';
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

  it("shows which slots apply to each product type, in the specification's words", () => {
    render(<DictionaryBrowser dictionary={dictionary} />);

    expect(screen.getByRole('heading', { name: 'Which slots apply' })).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Slot',
      'Bowl lid BLD',
      'Bowl BWL',
      'Cup lid CLD',
      'Stand-up pouch SUP',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(15);

    const topDiameter = within(table).getByRole('row', { name: /Top diameter/ });
    expect(within(topDiameter).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Round only',
      'Round only',
      'Round only',
      'X',
    ]);
    const basisWeight = within(table).getByRole('row', { name: /Basis weight/ });
    expect(within(basisWeight).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Paper family only',
      'Paper family only',
      'Paper family only',
      'Yes',
    ]);
    const length = within(table).getByRole('row', { name: /Length/ });
    expect(within(length).getAllByRole('cell')[0]?.textContent).toBe('Non-round only');
  });
});
