import { describe, expect, it } from 'vitest';
import { navItemsFor } from './nav';

describe('navItemsFor', () => {
  it('gives everyone Theme, and no one Tools', () => {
    expect(navItemsFor(false).map((item) => item.label)).toEqual(['Theme']);
  });

  it('adds Accounts for an admin', () => {
    expect(navItemsFor(true).map((item) => item.label)).toEqual(['Theme', 'Accounts']);
  });
});