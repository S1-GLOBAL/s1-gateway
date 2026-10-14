import type { ThemePreferenceStore } from '../application/theme-ports';
import { isThemePreference, type ThemePreference } from '../domain/theme';

/** Also read by the inline script in index.html, before React starts. Keep the two in step. */
export const THEME_STORAGE_KEY = 's1-gateway.theme';

/**
 * The preference in localStorage. Storage can be missing or throw (a private
 * window, blocked site data); then every read is `system` and writes do nothing.
 */
export class LocalStorageThemePreferenceStore implements ThemePreferenceStore {
  private readonly storage: Storage | undefined;

  constructor(storage: Storage | undefined) {
    this.storage = storage;
  }

  read(): ThemePreference {
    try {
      const value = this.storage?.getItem(THEME_STORAGE_KEY);
      return isThemePreference(value) ? value : 'system';
    } catch {
      return 'system';
    }
  }

  write(preference: ThemePreference): void {
    try {
      this.storage?.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Not remembered; the choice still applies for this visit.
    }
  }
}

/** `window.localStorage`, or undefined where reading it throws. */
export function browserLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
