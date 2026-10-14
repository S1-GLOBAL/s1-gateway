import { describe, expect, it } from 'vitest';
import { InvalidToolError } from './tool.errors.js';
import { Tool, type NewTool } from './tool.js';

const ID = '00000000-0000-4000-8000-000000000001';
const AT = new Date('2026-10-14T08:00:00.000Z');
const valid: NewTool = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };

function issuesFor(input: NewTool) {
  const result = Tool.create(input, ID, AT);
  if (result.ok) throw new Error('expected the tool to be rejected');
  expect(result.error).toBeInstanceOf(InvalidToolError);
  return result.error.issues;
}

describe('Tool.create', () => {
  it('creates a tool from valid input, trimming every field', () => {
    const result = Tool.create(
      { name: '  Payroll ', url: ' https://payroll.example.com ', description: ' Pay ', category: ' Finance ' },
      ID,
      AT,
    );
    if (!result.ok) throw result.error;
    expect(result.value.id).toBe(ID);
    expect(result.value.name).toBe('Payroll');
    expect(result.value.url).toBe('https://payroll.example.com');
    expect(result.value.description).toBe('Pay');
    expect(result.value.category).toBe('Finance');
    expect(result.value.createdAt).toEqual(AT);
  });

  it('defaults the description to empty', () => {
    const result = Tool.create(valid, ID, AT);
    expect(result.ok && result.value.description).toBe('');
  });

  it('accepts a plain http URL', () => {
    expect(Tool.create({ ...valid, url: 'http://intranet.local/payroll' }, ID, AT).ok).toBe(true);
  });

  it('accepts fields exactly at their limits', () => {
    const url = `https://example.com/${'a'.repeat(2048 - 'https://example.com/'.length)}`;
    const result = Tool.create(
      { name: 'n'.repeat(80), url, description: 'd'.repeat(280), category: 'c'.repeat(40) },
      ID,
      AT,
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    ['an empty name', { ...valid, name: '   ' }, 'name'],
    ['a name over 80 characters', { ...valid, name: 'n'.repeat(81) }, 'name'],
    ['a relative URL', { ...valid, url: '/payroll' }, 'url'],
    ['a javascript: URL', { ...valid, url: 'javascript:alert(1)' }, 'url'],
    ['an ftp: URL', { ...valid, url: 'ftp://files.example.com' }, 'url'],
    ['a URL over 2048 characters', { ...valid, url: `https://example.com/${'a'.repeat(2048)}` }, 'url'],
    ['a description over 280 characters', { ...valid, description: 'd'.repeat(281) }, 'description'],
    ['an empty category', { ...valid, category: '' }, 'category'],
    ['a category over 40 characters', { ...valid, category: 'c'.repeat(41) }, 'category'],
  ] as const)('rejects %s', (_label, input, field) => {
    const issues = issuesFor(input);
    expect(Object.keys(issues)).toEqual([field]);
    expect(issues[field]?.[0]).toEqual(expect.any(String));
  });

  // Postgres refuses a NUL in text (SQLSTATE 22021), which would surface as a 500.
  it.each([
    ['name', { ...valid, name: 'Pay\u0000roll' }],
    ['url', { ...valid, url: 'https://payroll.example.com/\u0000' }],
    ['description', { ...valid, description: 'Monthly\u0007pay' }],
    ['category', { ...valid, category: 'Fin\u0000ance' }],
  ] as const)('rejects a control character in %s', (field, input) => {
    expect(Object.keys(issuesFor(input))).toEqual([field]);
  });

  it('reports every broken rule at once', () => {
    const issues = issuesFor({ name: '', url: 'nope', category: '' });
    expect(Object.keys(issues).sort()).toEqual(['category', 'name', 'url']);
  });
});
