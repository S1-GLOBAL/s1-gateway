import { describe, expect, it } from 'vitest';
import { navItemFor, navItemsFor, navSections } from './nav';

describe('navItemsFor', () => {
  it('gives everyone Atlas and Dictionary Changes, then Theme last, and no one Tools', () => {
    expect(navItemsFor(false).map((item) => item.label)).toEqual(['Atlas', 'Dictionary Changes', 'Theme']);
  });

  it('puts Accounts between Dictionary Changes and Theme for an admin', () => {
    expect(navItemsFor(true).map((item) => item.label)).toEqual(['Atlas', 'Dictionary Changes', 'Accounts', 'Theme']);
  });
});

describe('navSections', () => {
  it('puts Atlas and Dictionary Changes under Catalog, Accounts under Access, and Theme under Other', () => {
    expect(navSections(navItemsFor(true)).map((section) => [section.label, section.items.map((item) => item.label)])).toEqual([
      ['Catalog', ['Atlas', 'Dictionary Changes']],
      ['Access', ['Accounts']],
      ['Other', ['Theme']],
    ]);
  });

  it('hides Access from someone who is not an admin', () => {
    expect(navSections(navItemsFor(false)).map((section) => [section.label, section.items.map((item) => item.label)])).toEqual([
      ['Catalog', ['Atlas', 'Dictionary Changes']],
      ['Other', ['Theme']],
    ]);
  });
});

describe('navItemFor', () => {
  it('finds the place for its own path and for a page inside it', () => {
    expect(navItemFor('/atlas')?.label).toBe('Atlas');
    expect(navItemFor('/atlas/new')?.label).toBe('Atlas');
    expect(navItemFor('/atlas/0b6f7a52-3c1d-4e8a-9f2b-5d4c3b2a1908')?.label).toBe('Atlas');
    expect(navItemFor('/dictionary/changes')?.label).toBe('Dictionary Changes');
  });

  it('finds no place for a path that only starts with the same letters, or for none', () => {
    expect(navItemFor('/atlases')).toBeUndefined();
    expect(navItemFor('/nowhere')).toBeUndefined();
  });
});
