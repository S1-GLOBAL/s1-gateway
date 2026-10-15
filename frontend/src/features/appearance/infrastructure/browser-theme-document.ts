import { flushSync } from 'react-dom';
import type { ThemeDocument } from '../application/theme-ports';
import type { ResolvedTheme } from '../domain/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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
    // Read the canvas token after the theme attribute switches — one source
    // of truth in theme.css, no duplicated hex (frontend/DESIGN.md).
    const canvas = getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim();
    if (canvas) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas);
    }
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
