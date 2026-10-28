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
  change: null,
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid', searchWords: [] },
        { code: 'BWL', meaning: 'Bowl', searchWords: [] },
        { code: 'CLD', meaning: 'Cup lid', searchWords: [] },
        { code: 'SUP', meaning: 'Stand-up pouch', searchWords: [] },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', searchWords: [] },
        { code: 'APT', meaning: 'Polymer, PET', searchWords: [] },
        { code: 'B00', meaning: 'Paper and paperboard, grade not known', searchWords: [] },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft', searchWords: [] },
      ],
    },
    {
      key: 'coating',
      name: 'Coating',
      values: [
        { code: 'NC', meaning: 'No coating, as stated by the source', searchWords: [] },
        { code: 'PB', meaning: 'PE both sides', searchWords: [] },
        { code: 'PI', meaning: 'PE inside only', searchWords: [] },
        { code: 'PO', meaning: 'PE outside only', searchWords: [] },
      ],
    },
    {
      key: 'colourClarity',
      name: 'Colour / clarity',
      values: [
        { code: 'BR', meaning: 'Brown', searchWords: [] },
        { code: 'CL', meaning: 'Clear', searchWords: [] },
        { code: 'TL', meaning: 'Translucent', searchWords: [] },
        { code: 'WH', meaning: 'White', searchWords: [] },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'OV', meaning: 'Oval', searchWords: [] },
        { code: 'RC', meaning: 'Rectangular', searchWords: [] },
        { code: 'RD', meaning: 'Round', searchWords: [] },
        { code: 'SQ', meaning: 'Square', searchWords: [] },
      ],
    },
    {
      key: 'profile',
      name: 'Profile',
      values: [
        { code: 'DM', meaning: 'Dome', searchWords: [] },
        { code: 'FL', meaning: 'Flat', searchWords: [] },
        { code: 'HD', meaning: 'Half dome', searchWords: [] },
      ],
    },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'G', meaning: 'Grams', searchWords: [] },
        { code: 'M', meaning: 'Millilitres', searchWords: [] },
        { code: 'N', meaning: 'Count', searchWords: [] },
        { code: 'S', meaning: 'Servings', searchWords: [] },
        { code: 'Z', meaning: 'Ounces, nominal trade size', searchWords: [] },
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

  it('suggests matches as the text changes, across every slot', () => {
    render(<DictionaryBrowser dictionary={dictionary} />);
    const search = screen.getByRole('combobox', { name: 'Search' });

    fireEvent.change(search, { target: { value: 'l' } });
    expect(screen.getByRole('option', { name: /Bowl lid/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Clear/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: 'lid' } });
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options.some((text) => text?.includes('Bowl lid'))).toBe(true);
    expect(options.some((text) => text?.includes('Cup lid'))).toBe(true);
    expect(options.some((text) => text?.includes('Clear'))).toBe(false);
    expect(screen.queryByRole('article', { name: 'Shape' })).toBeNull();
    expect(within(screen.getByRole('article', { name: 'Product type' })).getByText('Cup lid')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Which slots apply' })).toBeNull();
  });

  it('follows the arrow keys, and marks the chosen value in its list', () => {
    render(<DictionaryBrowser dictionary={dictionary} />);
    const search = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.change(search, { target: { value: 'lid' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    const chosen = document.getElementById('dictionary-hit-productType-CLD');
    expect(chosen?.className).toContain('bg-surface-sunken');
    expect(screen.getAllByRole('option')[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('clears the search on Escape, and leaves the dictionary in place', () => {
    render(<DictionaryBrowser dictionary={dictionary} />);
    const search = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.change(search, { target: { value: 'lid' } });
    fireEvent.keyDown(search, { key: 'Escape' });

    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(7);
  });

  it('says when nothing matches, and restores the dictionary when the text is cleared', () => {
    render(<DictionaryBrowser dictionary={dictionary} />);
    const search = screen.getByRole('combobox', { name: 'Search' });

    fireEvent.change(search, { target: { value: 'qqqq' } });
    expect(screen.getByText('No codes or meanings match.')).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();

    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getAllByRole('article')).toHaveLength(7);
    expect(screen.getByRole('heading', { name: 'Which slots apply' })).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
