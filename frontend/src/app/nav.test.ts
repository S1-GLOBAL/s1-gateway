import { describe, expect, it } from 'vitest';
import { navItemsFor } from './nav';

describe('navItemsFor', () => {
  it('gives everyone Atlas, then Theme last, and no one Tools', () => {
    expect(navItemsFor(false).map((item) => item.label)).toEqual(['Atlas', 'Theme']);
  });

  it('puts Accounts between Atlas and Theme for an admin', () => {
    expect(navItemsFor(true).map((item) => item.label)).toEqual(['Atlas', 'Accounts', 'Theme']);
  });
});
