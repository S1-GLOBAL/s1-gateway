import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Tool } from '../domain/tool';
import { ToolCard } from './ToolCard';

const base: Tool = {
  id: 't1',
  name: 'Payroll',
  url: 'https://payroll.example.com',
  description: 'Monthly pay',
  category: 'Finance',
  createdAt: new Date(0),
};

describe('ToolCard', () => {
  it('links to the tool in a new tab, without an opener', () => {
    render(<ToolCard tool={base} />);
    const link = screen.getByRole('link', { name: 'Payroll' });
    expect(link.getAttribute('href')).toBe('https://payroll.example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('never turns a non-web URL into a link', () => {
    render(<ToolCard tool={{ ...base, url: 'javascript:alert(1)' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Payroll')).toBeTruthy();
  });
});
