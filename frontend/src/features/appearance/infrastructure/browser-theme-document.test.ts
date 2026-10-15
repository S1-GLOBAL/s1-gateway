import { afterEach, describe, expect, it } from 'vitest';
import { BrowserThemeDocument } from './browser-theme-document';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.removeProperty('--color-canvas');
  document.head.innerHTML = '';
});

describe('BrowserThemeDocument', () => {
  it('sets theme-color from the canvas token after a theme switch', () => {
    document.documentElement.style.setProperty('--color-canvas', '#f6f7f3');
    document.head.innerHTML = '<meta name="theme-color" content="#000000" />';

    new BrowserThemeDocument().apply('light');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f6f7f3');
  });

  it('reads the canvas token again when the theme switches', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
    const doc = new BrowserThemeDocument();

    document.documentElement.style.setProperty('--color-canvas', '#f6f7f3');
    doc.apply('light');
    document.documentElement.style.setProperty('--color-canvas', '#0b0c0b');
    doc.apply('dark');

    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b0c0b');
  });
});
