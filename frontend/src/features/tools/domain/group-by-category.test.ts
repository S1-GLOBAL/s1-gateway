import { describe, expect, it } from 'vitest';
import { groupByCategory } from './group-by-category';
import type { Tool } from './tool';

function tool(name: string, category: string): Tool {
  return { id: name, name, url: 'https://example.com', description: '', category, createdAt: new Date(0) };
}

describe('groupByCategory', () => {
  it('returns no groups for no tools', () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it('groups ignoring case, labelled as first seen', () => {
    const groups = groupByCategory([tool('Payroll', 'Finance'), tool('Expenses', 'finance')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.category).toBe('Finance');
  });

  it('sorts groups, and tools within a group, by name ignoring case', () => {
    const groups = groupByCategory([tool('Payroll', 'Finance'), tool('Leave', 'HR'), tool('expenses', 'Finance')]);
    expect(groups.map((group) => [group.category, group.tools.map((t) => t.name)])).toEqual([
      ['Finance', ['expenses', 'Payroll']],
      ['HR', ['Leave']],
    ]);
  });
});
