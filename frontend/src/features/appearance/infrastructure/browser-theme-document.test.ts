import { afterEach, describe, expect, it } from 'vitest';
import { BrowserThemeDocument } from './browser-theme-document';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.removeProperty('--color-canvas');
  document.head.innerHTML = '';
});

describe('BrowserThemeDocument', () => {
  it('sets theme-color from the canvas token after a theme switch', () => {
    document.documentElement.style.setProperty('--color-canvas', 'canvas-light');
    document.head.innerHTML = '<meta name="theme-color" content="initial" />';

    new BrowserThemeDocument().apply('light');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('canvas-light');
  });

  it('reads the canvas token again when the theme switches', () => {
    document.head.innerHTML = '<meta name="theme-color" content="initial" />';
    const doc = new BrowserThemeDocument();

    document.documentElement.style.setProperty('--color-canvas', 'canvas-light');
    doc.apply('light');
    document.documentElement.style.setProperty('--color-canvas', 'canvas-dark');
    doc.apply('dark');

    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('canvas-dark');
  });
});
