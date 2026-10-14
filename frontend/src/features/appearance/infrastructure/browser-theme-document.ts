import { flushSync } from 'react-dom';
import type { ThemeDocument } from '../application/theme-ports';
import type { ResolvedTheme } from '../domain/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The browser-chrome colour (address bar, PWA title bar) per theme: the canvas token. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#f6f7f3', dark: '#0b0c0b' };

export class BrowserThemeDocument implements ThemeDocument {
  prefersDark(): boolean {
    return window.matchMedia(DARK_QUERY).matches;
  }

  subscribe(listener: () => void): () => void {
    const query = window.matchMedia(DARK_QUERY);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }

  apply(theme: ResolvedTheme): void {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }

  /**
   * The whole page cross-fades between themes (ADR 0012). Where the View
   * Transitions API is missing, or the person asked for reduced motion, the
   * theme simply switches.
   */
  transition(update: () => void): void {
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    if (typeof document.startViewTransition !== 'function' || reduced) {
      update();
      return;
    }
    document.startViewTransition(() => flushSync(update));
  }
}
