import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageThemePreferenceStore, THEME_STORAGE_KEY } from './local-storage-theme-preference-store';

beforeEach(() => window.localStorage.clear());

describe('LocalStorageThemePreferenceStore', () => {
  it('reads system when nothing is stored', () => {
    expect(new LocalStorageThemePreferenceStore(window.localStorage).read()).toBe('system');
  });

  it('remembers what it writes', () => {
    const store = new LocalStorageThemePreferenceStore(window.localStorage);
    store.write('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(store.read()).toBe('dark');
  });

  it('reads system when the stored value is not a preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(new LocalStorageThemePreferenceStore(window.localStorage).read()).toBe('system');
  });

  it('works without storage at all', () => {
    const store = new LocalStorageThemePreferenceStore(undefined);
    store.write('light');
    expect(store.read()).toBe('system');
  });
});
