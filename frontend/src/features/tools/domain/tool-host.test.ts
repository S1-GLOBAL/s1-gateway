import { describe, expect, it } from 'vitest';
import { toolHost } from './tool-host';

describe('toolHost', () => {
  it('shows the host without a leading www', () => {
    expect(toolHost('https://www.payroll.example.com/login?x=1')).toBe('payroll.example.com');
  });

  it('keeps a port, which tells two internal services apart', () => {
    expect(toolHost('http://intranet.local:8080/a')).toBe('intranet.local:8080');
  });

  it('returns the text unchanged when it is not a URL', () => {
    expect(toolHost('not a url')).toBe('not a url');
  });
});
