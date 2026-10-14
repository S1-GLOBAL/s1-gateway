import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResolvedTheme, ThemePreference } from '../domain/theme';
import type { ThemeDocument, ThemePreferenceStore } from './theme-ports';
import { ThemeProvider, useTheme } from './theme-context';

class MemoryStore implements ThemePreferenceStore {
  value: ThemePreference;

  constructor(value: ThemePreference) {
    this.value = value;
  }

  read(): ThemePreference {
    return this.value;
  }

  write(preference: ThemePreference): void {
    this.value = preference;
  }
}

class FakeDocument implements ThemeDocument {
  dark: boolean;
  applied: ResolvedTheme[] = [];
  private listeners = new Set<() => void>();

  constructor(dark: boolean) {
    this.dark = dark;
  }

  prefersDark(): boolean {
    return this.dark;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  apply(theme: ResolvedTheme): void {
    this.applied.push(theme);
  }

  transition(update: () => void): void {
    update();
  }

  setSystemDark(dark: boolean): void {
    this.dark = dark;
    for (const listener of this.listeners) listener();
  }
}

function Probe() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <p>
        {preference}/{resolved}
      </p>
      <button type="button" onClick={() => setPreference('dark')}>
        dark
      </button>
    </div>
  );
}

function renderWith(store: MemoryStore, document: FakeDocument) {
  render(
    <ThemeProvider store={store} document={document}>
      <Probe />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  it('starts from the stored preference and applies the resolved theme', () => {
    const document = new FakeDocument(true);
    renderWith(new MemoryStore('system'), document);
    expect(screen.getByText('system/dark')).toBeTruthy();
    expect(document.applied.at(-1)).toBe('dark');
  });

  it('follows the system while the preference is system', () => {
    const document = new FakeDocument(false);
    renderWith(new MemoryStore('system'), document);
    act(() => document.setSystemDark(true));
    expect(screen.getByText('system/dark')).toBeTruthy();
    expect(document.applied.at(-1)).toBe('dark');
  });

  it('stores and applies a new preference', () => {
    const store = new MemoryStore('light');
    const document = new FakeDocument(false);
    renderWith(store, document);
    act(() => screen.getByRole('button', { name: 'dark' }).click());
    expect(store.value).toBe('dark');
    expect(screen.getByText('dark/dark')).toBeTruthy();
    expect(document.applied.at(-1)).toBe('dark');
  });
});
