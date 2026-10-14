import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ThemeDocument, ThemePreferenceStore } from '../application/theme-ports';
import { ThemeProvider } from '../application/theme-context';
import type { ResolvedTheme, ThemePreference } from '../domain/theme';
import { ThemeSwitch } from './ThemeSwitch';

function setup(initial: ThemePreference) {
  const stored: ThemePreference[] = [initial];
  const applied: ResolvedTheme[] = [];
  const store: ThemePreferenceStore = {
    read: () => stored.at(-1) ?? 'system',
    write: (preference) => {
      stored.push(preference);
    },
  };
  const document: ThemeDocument = {
    prefersDark: () => false,
    subscribe: () => () => undefined,
    apply: (theme) => {
      applied.push(theme);
    },
    transition: (update) => update(),
  };
  render(
    <ThemeProvider store={store} document={document}>
      <ThemeSwitch />
    </ThemeProvider>,
  );
  return { stored, applied };
}

describe('ThemeSwitch', () => {
  it('offers the three choices, with the current one checked', () => {
    setup('system');
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Match device' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('false');
  });

  it('remembers and applies a choice', () => {
    const { stored, applied } = setup('light');
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(stored.at(-1)).toBe('dark');
    expect(applied.at(-1)).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
  });

  it('moves the choice with the arrow keys', () => {
    const { stored } = setup('light');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Light' }), { key: 'ArrowRight' });
    expect(stored.at(-1)).toBe('dark');
  });
});
