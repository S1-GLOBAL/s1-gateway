import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, type ThemeDocument, type ThemePreferenceStore } from '@/features/appearance';
import { ThemePage } from './ThemePage';

function renderPage() {
  const store: ThemePreferenceStore = { read: () => 'light', write: () => undefined };
  const document: ThemeDocument = {
    prefersDark: () => false,
    subscribe: () => () => undefined,
    apply: () => undefined,
    transition: (update) => update(),
  };
  render(
    <ThemeProvider store={store} document={document}>
      <ThemePage />
    </ThemeProvider>,
  );
}

describe('ThemePage', () => {
  it('shows all eight parts of the system, in order', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Brand', 'Colour', 'Type', 'Controls', 'Surfaces', 'Icons', 'Loading', 'Motion']);
  });

  it('shows the skeleton when the sample is set to loading', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Loading' }));
    expect(screen.getByRole('status', { name: 'Loading samples' })).toBeTruthy();
  });

  it('shows the error state when the sample fails, and recovers on Try again', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Failed' }));
    expect(screen.getByText('These tools could not load.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Claims, receipts and approvals.')).toBeTruthy();
  });
});
