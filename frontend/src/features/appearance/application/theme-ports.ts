import type { ResolvedTheme, ThemePreference } from '../domain/theme';

/** Where the preference is remembered. Never throws: a broken store reads `system`. */
export interface ThemePreferenceStore {
  read(): ThemePreference;
  write(preference: ThemePreference): void;
}

/** The page the theme is drawn on. */
export interface ThemeDocument {
  /** Whether the device is set to dark right now. */
  prefersDark(): boolean;
  /** Calls `listener` whenever the device's setting changes. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Draws the page in `theme`. */
  apply(theme: ResolvedTheme): void;
  /** Runs `update` — synchronously — inside a cross-fade where the browser supports one. */
  transition(update: () => void): void;
}
