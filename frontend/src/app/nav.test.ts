import { describe, expect, it } from 'vitest';
import { navItemFor, navItemsFor } from './nav';

describe('navItemsFor', () => {
  it('gives everyone Atlas and Dictionary changes, then Theme last, and no one Tools', () => {
    expect(navItemsFor(false).map((item) => item.label)).toEqual(['Atlas', 'Dictionary changes', 'Theme']);
  });

  it('puts Accounts between Dictionary changes and Theme for an admin', () => {
    expect(navItemsFor(true).map((item) => item.label)).toEqual(['Atlas', 'Dictionary changes', 'Accounts', 'Theme']);
  });
});

describe('navItemFor', () => {
  it('finds the place for its own path and for a page inside it', () => {
    expect(navItemFor('/atlas')?.label).toBe('Atlas');
    expect(navItemFor('/atlas/new')?.label).toBe('Atlas');
    expect(navItemFor('/atlas/0b6f7a52-3c1d-4e8a-9f2b-5d4c3b2a1908')?.label).toBe('Atlas');
    expect(navItemFor('/dictionary/changes')?.label).toBe('Dictionary changes');
  });

  it('finds no place for a path that only starts with the same letters, or for none', () => {
    expect(navItemFor('/atlases')).toBeUndefined();
    expect(navItemFor('/nowhere')).toBeUndefined();
  });
});
