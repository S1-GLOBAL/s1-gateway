import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebUrl } from './is-web-url';

afterEach(() => vi.unstubAllGlobals());

describe('isWebUrl', () => {
  // URL.canParse arrived in Safari 17; an installed PWA on iOS 16 has no such method.
  it('works in a browser without URL.canParse', () => {
    const { URL: RealURL } = globalThis;
    class LegacyURL extends RealURL {}
    Object.defineProperty(LegacyURL, 'canParse', { value: undefined });
    vi.stubGlobal('URL', LegacyURL);

    expect(isWebUrl('https://payroll.example.com')).toBe(true);
    expect(isWebUrl('/relative')).toBe(false);
  });

  it.each(['https://payroll.example.com', 'http://intranet.local/a'])('accepts %s', (url) => {
    expect(isWebUrl(url)).toBe(true);
  });

  it.each(['javascript:alert(1)', 'ftp://files.example.com', '/relative', ''])('rejects %s', (url) => {
    expect(isWebUrl(url)).toBe(false);
  });
});
