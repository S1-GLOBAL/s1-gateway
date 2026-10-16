import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectField } from './SelectField';

const OPTIONS = [
  { value: '', label: 'Not known' },
  { value: 'RD', label: 'RD — Round' },
];

describe('SelectField', () => {
  it('is found by its label and offers its options', () => {
    render(<SelectField label="Shape" options={OPTIONS} defaultValue="" />);
    const select = screen.getByRole('combobox', { name: 'Shape' });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Not known', 'RD — Round']);
    expect((select as HTMLSelectElement).value).toBe('');
  });

  it('reports a choice', () => {
    const onChange = vi.fn();
    render(<SelectField label="Shape" options={OPTIONS} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Shape' }), { target: { value: 'RD' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows the error in place of the hint, and marks itself invalid', () => {
    render(<SelectField label="Shape" options={OPTIONS} hint="Pick one." errors={['Shape: QQ is not in the dictionary.']} />);
    const select = screen.getByRole('combobox', { name: 'Shape' });
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Shape: QQ is not in the dictionary.')).toBeTruthy();
    expect(screen.queryByText('Pick one.')).toBeNull();
  });

  it('can be locked', () => {
    render(<SelectField label="Gusset" options={[{ value: 'X', label: "Doesn't apply" }]} disabled />);
    expect(screen.getByRole('combobox', { name: 'Gusset' }).hasAttribute('disabled')).toBe(true);
  });
});
